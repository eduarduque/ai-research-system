import { describe, it, expect } from "vitest";
import { finalizeAnswer, citedNumbers } from "@/lib/ask";
import { stripReferenceMarkers } from "@/lib/ingest";

const citations = [
  { n: 1, source_id: "a" },
  { n: 2, source_id: "a" },
  { n: 3, source_id: "b" },
];
const sources = [
  { id: "a", title: "Article A", url: "https://a.com" },
  { id: "b", title: "Article B", url: "https://b.com" },
];

describe("finalizeAnswer", () => {
  it("removes citation numbers that don't map to a retrieved excerpt", () => {
    const out = finalizeAnswer("## Answer\nRAG grounds answers [1][18]. It still fails [7].", citations, sources);
    expect(out).toContain("grounds answers [1].");
    expect(out).not.toMatch(/\[18\]|\[7\]/);
    expect(out).toContain("It still fails.");
  });

  it("expands comma lists and keeps only valid members", () => {
    expect(finalizeAnswer("## Answer\nX [1, 3, 9].", citations, sources)).toContain("X [1][3].");
  });

  it("replaces the model's Sources Used with the sources it actually cited", () => {
    const raw = "## Answer\nOnly A matters [2].\n\n## Sources Used\n- Ars Technica: https://arstechnica.com";
    const out = finalizeAnswer(raw, citations, sources);
    expect(out).not.toContain("arstechnica");
    expect(out).toContain("- Article A: https://a.com");
    expect(out).not.toContain("Article B");
  });

  it("normalizes full-width and footnote-style citations (gpt-oss emits 【1】)", () => {
    expect(finalizeAnswer("## Answer\nLoan was $275M【1】【2】 and [^3].", citations, sources)).toContain(
      "Loan was $275M[1][2] and [3]."
    );
  });

  it("adds the Answer heading when the model omits it", () => {
    expect(finalizeAnswer("Plain text [3]", citations, sources)).toMatch(/^## Answer\nPlain text \[3\]/);
  });
});

describe("citedNumbers", () => {
  it("finds single and list citations", () => {
    expect(citedNumbers("a [1] b [2, 3] c [10]")).toEqual([1, 2, 3, 10]);
  });
});

describe("stripReferenceMarkers", () => {
  it("removes Wikipedia-style footnotes but keeps real brackets", () => {
    expect(stripReferenceMarkers("RAG was proposed in 2020.[4][5] It works[citation needed].")).toBe(
      "RAG was proposed in 2020. It works."
    );
    expect(stripReferenceMarkers("Use array[index] and [Smith, 2020]")).toBe("Use array[index] and [Smith, 2020]");
  });
});
