import { cosineSimilarity } from "./embeddings";

export type RetrievalMode = "hybrid" | "vector" | "keyword";

export type CandidateChunk = {
  id: string;
  source_id: string;
  text: string;
  /** Prefix (title) that is searchable but not part of the chunk text itself. */
  title?: string;
  vector: ArrayLike<number> | null;
};

export type RankedChunk<T extends CandidateChunk> = T & { score: number };

const STOPWORDS = new Set(
  ("a an and are as at be but by can did do does for from had has have how i if in into is it its of on or " +
    "so than that the their them then there these they this to was were what when where which who why will " +
    "with would you your about after all also any been being both could each few more most other over same " +
    "should some such only own very just now new said says")
    .split(" ")
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]*[a-z0-9+#]|[a-z0-9]/g) ?? []).filter(
    (t) => !STOPWORDS.has(t)
  );
}

/**
 * Okapi BM25 over the candidate set. Unlike the old "count matching words"
 * score it down-weights terms that appear everywhere (IDF) and long chunks
 * that match by sheer length (length normalization).
 */
export function bm25Scores(query: string, docs: string[], k1 = 1.2, b = 0.75): number[] {
  const qTerms = [...new Set(tokenize(query))];
  if (qTerms.length === 0 || docs.length === 0) return docs.map(() => 0);

  const docTokens = docs.map(tokenize);
  const avgLen = docTokens.reduce((s, t) => s + t.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const tokens of docTokens) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }

  return docTokens.map((tokens) => {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const term of qTerms) {
      const f = tf.get(term);
      if (!f) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * tokens.length) / avgLen)));
    }
    return score;
  });
}

/**
 * Reciprocal Rank Fusion: combine several rankings without having to calibrate
 * BM25 scores against cosine similarities (they live on unrelated scales).
 * score(d) = Σ 1 / (k + rank_i(d))
 */
export function reciprocalRankFusion(rankings: string[][], k = 60): Map<string, number> {
  const fused = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, rank) => fused.set(id, (fused.get(id) ?? 0) + 1 / (k + rank + 1)));
  }
  return fused;
}

/**
 * Rank chunks for a query. `queryVector` may be null (no embedding provider, or
 * the provider failed) — hybrid then degrades to keyword-only instead of failing.
 * At most `perSource` chunks per source are returned so one long article can't
 * crowd every other source out of the context window.
 */
export function rankChunks<T extends CandidateChunk>(
  query: string,
  queryVector: ArrayLike<number> | null,
  chunks: T[],
  opts: { mode?: RetrievalMode; k?: number; perSource?: number } = {}
): RankedChunk<T>[] {
  const { mode = "hybrid", k = 6, perSource = 2 } = opts;
  if (chunks.length === 0) return [];

  const useVector = mode !== "keyword" && queryVector !== null;
  const useKeyword = mode !== "vector" || queryVector === null;

  const rankings: string[][] = [];
  const raw = new Map<string, number>();

  if (useKeyword) {
    const scores = bm25Scores(query, chunks.map((c) => `${c.title ?? ""} ${c.text}`));
    const ranked = chunks.map((c, i) => ({ id: c.id, s: scores[i] })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s);
    rankings.push(ranked.map((r) => r.id));
    for (const r of ranked) raw.set(r.id, r.s);
  }
  if (useVector) {
    const ranked = chunks
      .filter((c) => c.vector && c.vector.length === queryVector!.length)
      .map((c) => ({ id: c.id, s: cosineSimilarity(queryVector!, c.vector!) }))
      // Below ~0.15 MiniLM/OpenAI similarities are noise; don't let them into the fusion.
      .filter((r) => r.s > 0.15)
      .sort((a, b) => b.s - a.s);
    rankings.push(ranked.map((r) => r.id));
    for (const r of ranked) if (!raw.has(r.id)) raw.set(r.id, r.s);
  }

  const scores = rankings.length === 1 ? raw : reciprocalRankFusion(rankings);
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const perSourceCount = new Map<string, number>();
  const out: RankedChunk<T>[] = [];

  const ordered = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const deferred: [string, number][] = [];
  for (const [id, score] of ordered) {
    const chunk = byId.get(id)!;
    const n = perSourceCount.get(chunk.source_id) ?? 0;
    if (n >= perSource) {
      deferred.push([id, score]);
      continue;
    }
    perSourceCount.set(chunk.source_id, n + 1);
    out.push({ ...chunk, score });
    if (out.length >= k) return out;
  }
  // The cap is for diversity, not scarcity: if few sources are relevant, fill the
  // remaining slots with their next-best chunks instead of sending less context.
  for (const [id, score] of deferred) {
    if (out.length >= k) break;
    out.push({ ...byId.get(id)!, score });
  }
  return out;
}
