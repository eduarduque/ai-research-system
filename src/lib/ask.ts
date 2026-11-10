import { getAllChunks, countSources } from "./db";
import { embedText, getEmbeddingModelId, blobToVector } from "./embeddings";
import { rankChunks, type RetrievalMode } from "./retrieval";
import { getAIClient } from "./ai";

export type Citation = { n: number; source_id: string; title: string; url: string; snippet: string; score: number };

export type AskResult = {
  answer: string;
  sources: { id: string; title: string; url: string }[];
  citations: Citation[];
  retrieval: { mode: RetrievalMode; embeddingModel: string | null; candidates: number };
};

/** Citation numbers like [3] or [2, 4] used in an answer body. */
export function citedNumbers(answer: string): number[] {
  const nums: number[] = [];
  for (const m of answer.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    for (const n of m[1].split(",")) nums.push(Number(n.trim()));
  }
  return nums;
}

/**
 * Post-process a model answer so its citations can be trusted:
 * - drop [n] markers that don't correspond to a retrieved excerpt,
 * - replace the model's "Sources Used" (which it can hallucinate) with the
 *   sources actually cited, derived from the retrieval results.
 */
export function finalizeAnswer(
  raw: string,
  citations: Pick<Citation, "n" | "source_id">[],
  sources: { id: string; title: string; url: string }[]
): string {
  const max = citations.length;
  let body = (raw.split(/\n#+\s*Sources Used/i)[0] || "").trim();
  body = body
    .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, list: string) => {
      const valid = list.split(",").map((n) => Number(n.trim())).filter((n) => n >= 1 && n <= max);
      return valid.map((n) => `[${n}]`).join("");
    })
    .replace(/[ \t]+([.,;:])/g, "$1");
  if (!body) body = "## Answer\nNo answer generated.";
  if (!/^##\s*Answer/i.test(body)) body = `## Answer\n${body}`;

  const citedSourceIds = new Set(citedNumbers(body).map((n) => citations[n - 1]?.source_id));
  const used = sources.filter((s) => citedSourceIds.has(s.id));
  const list = (used.length ? used : sources).map((s) => `- ${s.title}: ${s.url}`).join("\n");
  return `${body}\n\n## Sources Used\n${list}`;
}

/** Retrieve the most relevant chunks for a question (hybrid BM25 + vector when available). */
export async function retrieve(question: string, k = 6) {
  const rows = getAllChunks();
  const model = getEmbeddingModelId();

  let queryVector: number[] | null = null;
  if (model && rows.some((r) => r.model === model)) {
    try {
      queryVector = (await embedText(question)).vector;
    } catch (err) {
      console.warn("Query embedding failed — keyword retrieval only:", err instanceof Error ? err.message : err);
    }
  }

  const candidates = rows.map((r) => ({
    id: r.id,
    source_id: r.source_id,
    text: r.text,
    title: r.title,
    url: r.url,
    // Only vectors from the active model are comparable to the query vector.
    vector: r.embedding && r.model === model ? blobToVector(r.embedding) : null,
  }));

  const mode: RetrievalMode = queryVector ? "hybrid" : "keyword";
  return { ranked: rankChunks(question, queryVector, candidates, { mode, k }), mode, model, candidates: rows.length };
}

export async function answerQuestion(question: string): Promise<AskResult> {
  const empty = (answer: string): AskResult => ({
    answer,
    sources: [],
    citations: [],
    retrieval: { mode: "keyword", embeddingModel: getEmbeddingModelId(), candidates: 0 },
  });

  if (countSources() === 0) {
    return empty("## Answer\nNo research saved yet. Ingest some sources first.\n\n## Sources Used\nNone");
  }

  const { ranked, mode, model, candidates } = await retrieve(question);
  if (ranked.length === 0) {
    return empty("## Answer\nNo relevant research found for this question. Try ingesting more sources.\n\n## Sources Used\nNone");
  }

  const citations: Citation[] = ranked.map((r, i) => ({
    n: i + 1,
    source_id: r.source_id,
    title: r.title,
    url: r.url,
    snippet: r.text,
    score: Number(r.score.toFixed(4)),
  }));

  const seen = new Set<string>();
  const sources = citations
    .filter((c) => !seen.has(c.source_id) && seen.add(c.source_id))
    .map((c) => ({ id: c.source_id, title: c.title, url: c.url }));
  const sourceList = sources.map((s) => `- ${s.title}: ${s.url}`).join("\n");

  const context = citations.map((c) => `[${c.n}] ${c.title} (${c.url})\n${c.snippet}`).join("\n\n---\n\n");

  let answer: string;
  const ai = getAIClient();
  if (ai) {
    try {
      const completion = await ai.client.chat.completions.create({
        model: ai.model,
        temperature: 0.2,
        max_completion_tokens: 4000,
        messages: [
          {
            role: "system",
            content:
              "You are a research analyst answering questions strictly from the user's saved research excerpts. " +
              "Every factual sentence must cite at least one excerpt number like [1] or [2][3]. " +
              "Use specific names and numbers from the excerpts. If the excerpts do not contain the answer, say so " +
              "plainly instead of using outside knowledge. Never invent excerpt numbers.",
          },
          {
            role: "user",
            content: `QUESTION: ${question}\n\nEXCERPTS:\n${context}\n\nRespond in exactly this format:\n## Answer\n<answer with [n] citations>\n\n## Sources Used\n<one line per cited source: title — url>`,
          },
        ],
      });
      answer = finalizeAnswer(completion.choices[0].message.content?.trim() || "", citations, sources);
    } catch (aiErr: unknown) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      console.warn(`AI answer synthesis failed (${ai.provider}):`, msg);
      answer = `## Answer\nCould not synthesize an AI answer (${msg.includes("429") ? "API quota exceeded" : "AI unavailable"}). Most relevant sources below.\n\n## Sources Used\n${sourceList}`;
    }
  } else {
    answer = `## Answer\nNo AI provider configured — here are the most relevant passages for "${question}".\n\n## Sources Used\n${sourceList}`;
  }

  return { answer, sources, citations, retrieval: { mode, embeddingModel: model, candidates } };
}
