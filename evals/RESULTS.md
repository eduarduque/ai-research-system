# Evaluation results

Reproduce: `npm run eval` (needs an LLM provider) or `npm run eval -- --retrieval-only` (no LLM, runs in CI).
Raw output: [`results/latest.json`](results/latest.json) (with per-question details) · first run: [`results/baseline-v1.json`](results/baseline-v1.json).

## Setup

| | |
|---|---|
| Corpus | 12 target articles + 16 near-duplicate distractors = 28 docs → 34 chunks |
| Questions | 38: 12 lexical, 18 paraphrase (little word overlap with the source), 3 exact-identifier, 2 multi-source, 3 unanswerable |
| Embeddings | `Xenova/all-MiniLM-L6-v2` (local, q8) |
| LLM | Groq `openai/gpt-oss-20b` (free tier) |

The corpus is **fictional** (made-up companies, people and figures), so the model cannot answer from its training data, and a correct answer is evidence that retrieval and grounding work. The distractors cover the same topics as the targets with different names and numbers (a second sodium-ion startup, a second recycling plant, another optical-chip company), which makes retrieval non-trivial and gives the model plausible wrong facts to pick up.

## Retrieval

Source-level metrics over the 35 answerable questions (k = 10 chunks, ≤ 2 per source in the first pass).

| Retriever | Hit@1 | Recall@5 | MRR | Hit@1 paraphrase | Hit@1 identifier |
|---|---|---|---|---|---|
| BM25 only | 91.4% | 94.3% | 0.939 | 83.3% | 100% |
| Vector only | 100% | 100% | 1.000 | 100% | 100% |
| Hybrid, BM25 weight 1.0 | 94.3% | 98.6% | 0.971 | 88.9% | 100% |
| Hybrid, BM25 weight 0.5 | 97.1% | 98.6% | 0.986 | 94.4% | 100% |
| **Hybrid, BM25 weight 0.25 (default)** | **100%** | **98.6%** | **1.000** | **100%** | **100%** |

**What this shows.** With equal weights, fusion *lost* to vector search alone. On paraphrased questions, BM25 confidently ranked a distractor first (e.g. "Which startup computes neural network math using light?" matched the photonic-interconnect distractor on "photonic"/"light"), and equal-weight RRF let that override the correct semantic match. Down-weighting BM25 fixes this.

**Caveats, stated plainly.** The weight was chosen from this sweep, so the 0.25 row is an in-sample number on a small set. Vector-only ties it here. Hybrid is kept as the default for reasons this corpus doesn't measure well: it degrades gracefully when embeddings are unavailable, and BM25 is the stronger signal for rare tokens (codes, version strings, names) in larger libraries, where small embedding models blur them. The one Recall@5 miss is a multi-source question ("Which companies are making batteries cheaper *and* which are recycling them?") whose second source fell out of the top 5.

## Answers and briefs

| Metric | Run 1 (baseline) | Final | What changed |
|---|---|---|---|
| Answers with ≥ 1 valid citation | 88.6% | **100%** | **System fix:** gpt-oss cites as `【1】`; these weren't recognized, so citations were silently dropped and not linked in the UI. Now normalized to `[1]`. |
| Citation precision (cited passage is from a correct source) | 96.0% | **95.7%** | — (within noise) |
| Fact recall (expected figure appears in the answer) | 77.1% | **98.6%** | **Mostly a measurement fix:** the model writes `38 %` with a narrow no-break space, which plain string matching scored as a miss. When per-question details were added (run 2), 9 of the 13 flagged answers were exactly this, and one expected string was over-literal ("1 of the 4" vs. the model's "1 of 4"). |
| Refuses on unanswerable questions | 2/3 | **3/3** | **Measurement fix:** "No relevant research found" (returned when retrieval finds nothing) wasn't counted as a refusal. Behavior was already correct. |
| Refuses when the answer exists (false refusal) | 2.9% | 2.9% | 1 of 35. In the runs with per-question details it was the multi-source question above: the model said no excerpt covered "cheaper batteries" and answered only the recycling half. |
| Brief JSON passes schema | 75% | **100%** | **System fixes:** (1) two briefs were rejected by Groq with HTTP 413 because the 16k completion cap counts against the free tier's per-minute token budget; the cap is now 4k with `reasoning_effort: low`. (2) One brief returned list items as objects; these are now flattened instead of rejecting the brief. |
| Numbers in briefs that appear in the source | 100% | 99.0% | One figure was reformatted. |
| Median brief latency | 18.8 s | **8.3 s** | Low reasoning effort on gpt-oss. |
| Median answer latency | 8.7 s | 7.9 s | Free-tier queueing dominates; varies run to run. |

**Notes on the final run.** One of the 38 answers hit Groq's free-tier daily token limit and is excluded from the rates (37 scored). The brief rows come from the second run; the brief code didn't change after it, and the third run used up the 200k tokens/day quota before reaching briefs. Both facts are recorded in `results/latest.json`.

## Lessons

1. **Measure the measurement.** Most of the headline gain in fact recall came from fixing the scorer, not the system. Reading per-question failures before changing prompts kept me from "fixing" a model that was already right.
2. **Evals find integration bugs that unit tests don't.** The `【1】` citation format and the 413-on-large-budget behavior both only show up against a real model and a real provider.
3. **Hybrid search isn't automatically better.** Naive equal-weight fusion was worse than one of its own inputs; the gain came from weighting.

## Limitations

38 questions on 28 documents is enough to catch regressions and compare configurations, not to make claims about production accuracy. Next steps would be a larger corpus with real articles, LLM-as-judge scoring for open-ended answers, and multiple runs per configuration to report variance.
