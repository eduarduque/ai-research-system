import { describe, it, expect } from "vitest";
import { chunkText } from "@/lib/chunk";
import { bm25Scores, reciprocalRankFusion, rankChunks, tokenize } from "@/lib/retrieval";
import { cosineSimilarity, vectorToBlob, blobToVector } from "@/lib/embeddings";

const para = (n: number, topic: string) =>
  Array.from({ length: n }, (_, i) => `Sentence ${i + 1} is about ${topic} and nothing else.`).join(" ");

describe("chunkText", () => {
  it("returns one chunk for short text", () => {
    expect(chunkText("Short article.")).toEqual([{ index: 0, text: "Short article." }]);
  });

  it("returns nothing for empty text", () => {
    expect(chunkText("   \n\n ")).toEqual([]);
  });

  it("splits long text into bounded, sentence-aligned, overlapping chunks", () => {
    const text = `${para(30, "batteries")}\n\n${para(30, "solar panels")}`;
    const chunks = chunkText(text, 400, 100);
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(400);
      expect(c.text.endsWith(".")).toBe(true);
    }
    // overlap: the start of chunk n+1 repeats the tail of chunk n
    const lastSentence = chunks[0].text.split(/(?<=\.) /).pop()!;
    expect(chunks[1].text.slice(0, 120)).toContain(lastSentence);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  it("hard-splits a single sentence longer than the chunk size", () => {
    const chunks = chunkText("word ".repeat(500), 200, 0);
    expect(chunks.every((c) => c.text.length <= 200)).toBe(true);
  });
});

describe("BM25", () => {
  it("tokenizes and drops stopwords while keeping tech terms", () => {
    expect(tokenize("What is the GPT-4o price in the U.S.?")).toEqual(["gpt-4o", "price", "u.s"]);
  });

  it("ranks the document that matches rare query terms highest", () => {
    const docs = [
      "The model is fast and the model is cheap.",
      "Anthropic released a new model with a larger context window.",
      "A recipe for bread.",
    ];
    const scores = bm25Scores("anthropic context window", docs);
    expect(scores[1]).toBeGreaterThan(scores[0]);
    expect(scores[2]).toBe(0);
  });

  it("returns zeros for a stopword-only query", () => {
    expect(bm25Scores("the of and", ["the cat"])).toEqual([0]);
  });
});

describe("reciprocalRankFusion", () => {
  it("rewards documents ranked well by both retrievers", () => {
    const fused = reciprocalRankFusion([
      ["a", "b", "c"],
      ["b", "c", "a"],
    ]);
    const order = [...fused.entries()].sort((x, y) => y[1] - x[1]).map(([id]) => id);
    expect(order[0]).toBe("b");
  });

  it("weights let one retriever dominate", () => {
    const rankings = [["kw-top", "sem-top"], ["sem-top", "kw-top"]];
    const top = (w: number[]) => [...reciprocalRankFusion(rankings, 60, w).entries()].sort((x, y) => y[1] - x[1])[0][0];
    expect(top([0.25, 1])).toBe("sem-top");
    expect(top([1, 0.25])).toBe("kw-top");
  });
});

describe("rankChunks", () => {
  const chunks = [
    { id: "1", source_id: "s1", text: "Solid-state batteries promise higher energy density.", vector: [1, 0, 0] },
    { id: "2", source_id: "s1", text: "Battery supply chains are concentrated in a few countries.", vector: [0.9, 0.1, 0] },
    { id: "3", source_id: "s1", text: "Battery recycling is growing fast.", vector: [0.8, 0.2, 0] },
    { id: "4", source_id: "s2", text: "Diffusion models generate images from noise.", vector: [0, 1, 0] },
    { id: "5", source_id: "s3", text: "Rooftop solar adoption doubled.", vector: [0, 0, 1] },
  ];

  it("keyword mode works without vectors", () => {
    const r = rankChunks("diffusion images", null, chunks, { mode: "keyword" });
    expect(r[0].id).toBe("4");
  });

  it("vector mode finds semantic matches with no keyword overlap", () => {
    const r = rankChunks("energy storage", [1, 0, 0], chunks, { mode: "vector" });
    expect(r[0].source_id).toBe("s1");
  });

  it("caps chunks per source so one article can't crowd out other relevant sources", () => {
    const withOther = [...chunks, { id: "6", source_id: "s4", text: "Battery storage pairs well with solar.", vector: [0.6, 0, 0.6] }];
    const r = rankChunks("battery", [1, 0, 0], withOther, { mode: "hybrid", perSource: 2, k: 3 });
    expect(r.filter((c) => c.source_id === "s1").length).toBe(2);
    expect(r.some((c) => c.source_id === "s4")).toBe(true);
  });

  it("backfills from capped sources when slots would otherwise go unused", () => {
    const r = rankChunks("battery", [1, 0, 0], chunks, { mode: "hybrid", perSource: 2, k: 10 });
    expect(r.filter((c) => c.source_id === "s1").length).toBe(3);
  });

  it("hybrid degrades to keyword when the query vector is missing", () => {
    const r = rankChunks("rooftop solar", null, chunks, { mode: "hybrid" });
    expect(r[0].id).toBe("5");
  });

  it("ignores vectors whose dimension doesn't match the query (mixed embedding models)", () => {
    const mixed = [{ id: "x", source_id: "sx", text: "unrelated", vector: [1, 0] }];
    expect(rankChunks("query", [1, 0, 0], mixed, { mode: "vector" })).toEqual([]);
  });
});

describe("vector helpers", () => {
  it("cosine similarity basics", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it("round-trips vectors through float32 BLOBs", () => {
    const v = [0.25, -1.5, 3];
    expect(Array.from(blobToVector(vectorToBlob(v)))).toEqual(v);
  });
});
