/**
 * Evaluation harness for the retrieval, answer and brief pipelines.
 *
 *   npm run eval                    # retrieval + answers + briefs (needs an LLM provider)
 *   npm run eval -- --retrieval-only  # no LLM calls; runs in CI
 *
 * The corpus is fictional on purpose: made-up companies and numbers mean the
 * model cannot answer from training data, so a correct answer is evidence of
 * grounding rather than memory.
 */
import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

const args = process.argv.slice(2);
const RETRIEVAL_ONLY = args.includes("--retrieval-only");
const LIMIT = Number(args[args.indexOf("--limit") + 1]) || Infinity;

// Isolated throwaway DB; never touch the real library.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ars-eval-"));
process.env.RESEARCH_DB_PATH = path.join(tmp, "eval.db");
process.env.BROWSER_SCRAPE = "false";
if (!process.env.EMBEDDING_PROVIDER) process.env.EMBEDDING_PROVIDER = "local";

type Doc = { id: string; title: string; url: string; content: string };
type Question = {
  q: string;
  sources: string[];
  facts: string[];
  kind: "lexical" | "paraphrase" | "identifier" | "multi" | "unanswerable";
};

const targets: Doc[] = JSON.parse(fs.readFileSync(path.join(__dirname, "dataset/corpus.json"), "utf8"));
// Near-duplicate articles on the same topics (different names and numbers) that no
// question targets. They make retrieval non-trivial and give the LLM tempting wrong facts.
const distractors: Doc[] = JSON.parse(fs.readFileSync(path.join(__dirname, "dataset/distractors.json"), "utf8"));
const corpus = [...targets, ...distractors];
const questions: Question[] = JSON.parse(fs.readFileSync(path.join(__dirname, "dataset/questions.json"), "utf8"));

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
// Fact matching must not depend on typography: models write "38 %" with narrow
// no-break spaces, typographic dashes, etc.
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u00a0\u202f\u2009\u2007]/g, " ")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .replace(/(\d) %/g, "$1%");

const ABSTAIN = /(no relevant research found|not (contain|mention|include|provide|specify|state|say|cover)|no (information|mention|data|details)|does(n't| not) (say|mention|specify|state|include|provide)|cannot (find|determine|answer)|unable to|isn't (mentioned|stated|specified)|not (available|specified|stated|mentioned|found|covered) in)/i;

async function main() {
  const { saveSource } = await import("../src/lib/ingest");
  const { getAllChunks } = await import("../src/lib/db");
  const { embedText, blobToVector, getEmbeddingModelId } = await import("../src/lib/embeddings");
  const { rankChunks } = await import("../src/lib/retrieval");
  const { answerQuestion, citedNumbers } = await import("../src/lib/ask");
  const { generateBriefData } = await import("../src/lib/briefs");
  const { getAIClient } = await import("../src/lib/ai");

  // ── Index the corpus ──
  const t0 = Date.now();
  const idToSource = new Map<string, string>(); // source uuid -> corpus id
  for (const d of corpus) {
    const { source } = await saveSource({ title: d.title, url: d.url, content: d.content });
    idToSource.set(source.id, d.id);
  }
  const rows = getAllChunks();
  const model = getEmbeddingModelId();
  console.log(`Indexed ${corpus.length} docs → ${rows.length} chunks with ${model} in ${Date.now() - t0} ms\n`);

  const candidates = rows.map((r) => ({
    id: r.id,
    source_id: r.source_id,
    text: r.text,
    title: r.title,
    vector: r.embedding && r.model === model ? blobToVector(r.embedding) : null,
  }));

  // ── Retrieval: keyword vs vector vs hybrid ──
  const answerable = questions.filter((q) => q.kind !== "unanswerable");
  const queryVectors = new Map<string, number[]>();
  for (const q of answerable) queryVectors.set(q.q, (await embedText(q.q)).vector);

  type RetrievalRow = { hit1: number; recall5: number; mrr: number; kind: Question["kind"] };
  const retrieval: Record<string, { overall: Record<string, number>; byKind: Record<string, Record<string, number>> }> = {};

  const { DEFAULT_KEYWORD_WEIGHT } = await import("../src/lib/retrieval");
  const configs = [
    { name: "keyword (BM25)", mode: "keyword" as const, w: 1 },
    { name: "vector", mode: "vector" as const, w: 1 },
    { name: "hybrid w=1.0", mode: "hybrid" as const, w: 1 },
    { name: "hybrid w=0.5", mode: "hybrid" as const, w: 0.5 },
    { name: "hybrid w=0.25", mode: "hybrid" as const, w: 0.25 },
  ];
  for (const { name, mode, w } of configs) {
    const results: RetrievalRow[] = answerable.map((q) => {
      const ranked = rankChunks(q.q, mode === "keyword" ? null : queryVectors.get(q.q)!, candidates, {
        mode,
        k: 10,
        perSource: 2,
        keywordWeight: w,
      });
      const docOrder = [...new Set(ranked.map((r) => idToSource.get(r.source_id)!))];
      const firstRel = docOrder.findIndex((d) => q.sources.includes(d));
      const top5 = docOrder.slice(0, 5);
      return {
        kind: q.kind,
        hit1: q.sources.includes(docOrder[0]) ? 1 : 0,
        recall5: q.sources.filter((s) => top5.includes(s)).length / q.sources.length,
        mrr: firstRel >= 0 ? 1 / (firstRel + 1) : 0,
      };
    });
    const summarize = (rs: RetrievalRow[]) => ({
      n: rs.length,
      hit_at_1: mean(rs.map((r) => r.hit1)),
      recall_at_5: mean(rs.map((r) => r.recall5)),
      mrr: mean(rs.map((r) => r.mrr)),
    });
    retrieval[name] = {
      overall: summarize(results),
      byKind: Object.fromEntries(
        (["lexical", "paraphrase", "identifier", "multi"] as const).map((k) => [k, summarize(results.filter((r) => r.kind === k))])
      ),
    };
  }

  console.log("Retrieval (source-level, %d answerable questions)", answerable.length);
  console.table(
    Object.fromEntries(
      Object.entries(retrieval).map(([m, r]) => [
        m,
        {
          "Hit@1": pct(r.overall.hit_at_1),
          "Recall@5": pct(r.overall.recall_at_5),
          MRR: r.overall.mrr.toFixed(3),
          "Hit@1 paraphrase": pct(r.byKind.paraphrase.hit_at_1),
          "Hit@1 identifier": pct(r.byKind.identifier.hit_at_1),
        },
      ])
    )
  );

  const report: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    corpus: { docs: corpus.length, target_docs: targets.length, distractors: distractors.length, chunks: rows.length, questions: questions.length },
    embedding_model: model,
    default_keyword_weight: DEFAULT_KEYWORD_WEIGHT,
    retrieval,
  };

  const ai = getAIClient();
  if (RETRIEVAL_ONLY || !ai) {
    if (!ai && !RETRIEVAL_ONLY) console.log("\nNo LLM provider configured — skipping answer and brief evals.");
  } else {
    report.llm = { provider: ai.provider, model: ai.model };

    // ── End-to-end answers ──
    const qs = questions.slice(0, LIMIT);
    const answerRows: {
      q: string;
      missing: string[];
      excerpt: string;
      kind: Question["kind"];
      factRecall: number;
      cited: number;
      citationPrecision: number | null;
      abstained: number;
      failed: number;
      ms: number;
    }[] = [];
    console.log(`\nAnswering ${qs.length} questions with ${ai.provider}:${ai.model} …`);
    for (const q of qs) {
      const start = Date.now();
      const r = await answerQuestion(q.q);
      const ms = Date.now() - start;
      const failed = /Could not synthesize an AI answer/.test(r.answer) ? 1 : 0;
      const body = norm(r.answer.split(/## Sources Used/i)[0]);
      const nums = [...new Set(citedNumbers(body))];
      const citedDocs = nums.map((n) => idToSource.get(r.citations[n - 1]?.source_id ?? "")).filter(Boolean) as string[];
      answerRows.push({
        q: q.q,
        missing: q.facts.filter((f) => !body.includes(norm(f))),
        excerpt: r.answer.split(/## Sources Used/i)[0].replace(/^## Answer\s*/i, "").slice(0, 300),
        kind: q.kind,
        factRecall: q.facts.length ? q.facts.filter((f) => body.includes(norm(f))).length / q.facts.length : 0,
        cited: nums.length > 0 ? 1 : 0,
        citationPrecision: citedDocs.length && q.sources.length ? citedDocs.filter((d) => q.sources.includes(d)).length / citedDocs.length : null,
        abstained: ABSTAIN.test(body) ? 1 : 0,
        failed,
        ms,
      });
      process.stdout.write(failed ? "x" : ".");
    }
    const ok = answerRows.filter((r) => !r.failed);
    const ans = ok.filter((r) => r.kind !== "unanswerable");
    const unans = ok.filter((r) => r.kind === "unanswerable");
    report.answers = {
      n: answerRows.length,
      failed: answerRows.length - ok.length,
      fact_recall: mean(ans.map((r) => r.factRecall)),
      answers_with_citation: mean(ans.map((r) => r.cited)),
      citation_precision: mean(ans.map((r) => r.citationPrecision).filter((x): x is number => x !== null)),
      abstention_on_unanswerable: mean(unans.map((r) => r.abstained)),
      false_abstention_on_answerable: mean(ans.map((r) => r.abstained)),
      median_latency_ms: ok.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(ok.length / 2)] ?? 0,
    };
    report.answer_details = answerRows.map(({ q, kind, factRecall, cited, abstained, missing, excerpt }) => ({
      q, kind, factRecall, cited, abstained, missing, excerpt,
    }));
    console.log("\n");
    console.table(report.answers);

    // ── Briefs ──
    const docs = targets.slice(0, LIMIT);
    const briefRows: { valid: number; numGrounding: number | null; entities: number; score: number; ms: number }[] = [];
    console.log(`Generating ${docs.length} briefs …`);
    for (const d of docs) {
      const start = Date.now();
      try {
        const b = await generateBriefData(d.title, d.url, d.content);
        const text = norm(d.content);
        const claimed = [b.summary, ...b.key_ideas].join(" ");
        const numbers = [...new Set(claimed.match(/\d[\d,.]*\d|\d/g) ?? [])].map((n) => n.replace(/[.,]$/, ""));
        briefRows.push({
          valid: 1,
          numGrounding: numbers.length ? numbers.filter((n) => text.includes(n)).length / numbers.length : null,
          entities: b.entities_topics.length,
          score: b.product_opportunity_score,
          ms: Date.now() - start,
        });
        process.stdout.write(".");
      } catch (err) {
        briefRows.push({ valid: 0, numGrounding: null, entities: 0, score: 0, ms: Date.now() - start });
        process.stdout.write("x");
        console.warn(`\n  brief failed for ${d.id}:`, err instanceof Error ? err.message.slice(0, 600) : err);
      }
    }
    const valid = briefRows.filter((r) => r.valid);
    report.briefs = {
      n: briefRows.length,
      schema_valid: mean(briefRows.map((r) => r.valid)),
      numeric_grounding: mean(valid.map((r) => r.numGrounding).filter((x): x is number => x !== null)),
      avg_grounded_entities: mean(valid.map((r) => r.entities)),
      score_range: valid.length ? [Math.min(...valid.map((r) => r.score)), Math.max(...valid.map((r) => r.score))] : null,
      median_latency_ms: valid.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(valid.length / 2)] ?? 0,
    };
    console.log("\n");
    console.table(report.briefs);
  }

  // ── Persist ──
  const outDir = path.join(__dirname, "results");
  fs.mkdirSync(outDir, { recursive: true });
  const file = RETRIEVAL_ONLY ? "retrieval.json" : "latest.json";
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(report, null, 2) + "\n");
  console.log(`\nWrote evals/results/${file}`);

  const { resetDb } = await import("../src/lib/db");
  resetDb();
  fs.rmSync(tmp, { recursive: true, force: true });

  // CI gate: fail if hybrid retrieval regresses below a floor.
  const floor = Number(process.env.EVAL_MIN_HYBRID_HIT1 ?? 0);
  const shipped = retrieval[`hybrid w=${DEFAULT_KEYWORD_WEIGHT === 1 ? "1.0" : DEFAULT_KEYWORD_WEIGHT}`] ?? retrieval["hybrid w=0.5"];
  if (shipped.overall.hit_at_1 < floor) {
    console.error(`Hybrid Hit@1 ${pct(shipped.overall.hit_at_1)} is below the floor ${pct(floor)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
