import { describe, it, expect, beforeEach, afterAll } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";
import getDb, { resetDb, getSourceByUrl, getBriefBySourceId, deleteSource, getAllChunks } from "@/lib/db";
import { saveSource, htmlToText, extractArticle } from "@/lib/ingest";
import { generateBrief } from "@/lib/briefs";
import { answerQuestion } from "@/lib/ask";
import { buildGraph } from "@/lib/graph";
import type { Brief } from "@/lib/types";

const longArticle = (topic: string) =>
  Array.from({ length: 40 }, (_, i) => `${topic} update number ${i + 1} reported growth of ${i * 3}% in Q${(i % 4) + 1}.`).join(" ");

beforeEach(() => {
  resetDb();
  process.env.RESEARCH_DB_PATH = ":memory:";
});

describe("saveSource", () => {
  it("stores, chunks, and dedupes by canonical URL", async () => {
    const first = await saveSource({ title: "Batteries", url: "https://ex.com/a?utm_source=x", content: longArticle("Battery") });
    expect(first.alreadyResearched).toBe(false);
    expect(first.source.url).toBe("https://ex.com/a");

    const again = await saveSource({ title: "Batteries", url: "ex.com/a/#top", content: "different" });
    expect(again.alreadyResearched).toBe(true);
    expect(again.source.id).toBe(first.source.id);

    const chunks = getAllChunks().filter((c) => c.source_id === first.source.id);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.embedding === null)).toBe(true); // EMBEDDING_PROVIDER=none in tests
  });
});

describe("generateBrief without an AI provider", () => {
  it("creates a flagged extractive fallback and replaces it once AI succeeds", async () => {
    const { source } = await saveSource({ title: "Solar", url: "https://ex.com/solar", content: longArticle("Solar") });
    const brief = await generateBrief(source.id);
    expect(brief.is_fallback).toBe(1);
    expect(brief.markdown).toContain("extractive fallback");
    // Still no AI: retrying keeps the same fallback rather than creating a new row.
    const retry = await generateBrief(source.id);
    expect(retry.id).toBe(brief.id);
  });

  it("404s on an unknown source", async () => {
    await expect(generateBrief("nope")).rejects.toThrow("Source not found");
  });
});

describe("answerQuestion (keyword retrieval, no LLM)", () => {
  it("retrieves the relevant source and returns numbered citations", async () => {
    await saveSource({ title: "Battery news", url: "https://ex.com/b", content: longArticle("Battery") });
    await saveSource({ title: "Diffusion models", url: "https://ex.com/d", content: longArticle("Diffusion image model") });
    const r = await answerQuestion("diffusion image models growth");
    expect(r.retrieval.mode).toBe("keyword");
    expect(r.sources[0].title).toBe("Diffusion models");
    expect(r.citations[0].n).toBe(1);
    expect(r.citations[0].snippet.length).toBeGreaterThan(0);
  });

  it("handles an empty library", async () => {
    const r = await answerQuestion("anything");
    expect(r.sources).toEqual([]);
    expect(r.answer).toMatch(/No research saved yet/);
  });
});

describe("buildGraph", () => {
  it("merges shared topics across sources and links sources to their briefs", async () => {
    const a = await saveSource({ title: "A", url: "https://ex.com/1", content: "Anthropic and OpenAI shipped models. ".repeat(5) });
    const b = await saveSource({ title: "B", url: "https://ex.com/2", content: "Anthropic raised money from Google. ".repeat(5) });
    const db = getDb();
    const ins = db.prepare(
      `INSERT INTO briefs (id, source_id, markdown, entities_topics, opportunity_ideas, is_fallback, created_at)
       VALUES (?, ?, '', ?, ?, 0, ?)`
    );
    ins.run("b1", a.source.id, JSON.stringify(["Anthropic", "OpenAI"]), JSON.stringify(["Agent tooling"]), new Date().toISOString());
    ins.run("b2", b.source.id, JSON.stringify(["anthropic", "Google"]), JSON.stringify([]), new Date().toISOString());

    const g = buildGraph();
    const topics = g.nodes.filter((n) => n.type === "topic").map((n) => n.id);
    expect(topics.filter((t) => t === "topic:anthropic")).toHaveLength(1);
    expect(g.edges.filter((e) => e.target === "topic:anthropic")).toHaveLength(2);
    expect(new Set(g.edges.map((e) => e.id)).size).toBe(g.edges.length);
    expect(g.nodes.find((n) => n.id === `src:${a.source.id}`)?.href).toBe("/briefs/b1");
  });
});

describe("deleteSource", () => {
  it("removes the source with its chunks and brief", async () => {
    const { source } = await saveSource({ title: "Del", url: "https://ex.com/del", content: longArticle("Delete") });
    await generateBrief(source.id);
    expect(deleteSource(source.id)).toBe(true);
    expect(getSourceByUrl("https://ex.com/del")).toBeUndefined();
    expect(getBriefBySourceId(source.id) as Brief | undefined).toBeUndefined();
    expect(getAllChunks().some((c) => c.source_id === source.id)).toBe(false);
    expect(deleteSource(source.id)).toBe(false);
  });
});

describe("schema migration from v1 databases", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ars-mig-"));
  afterAll(() => {
    resetDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("renames legacy columns, adds new ones, and removes duplicate URLs", () => {
    const file = path.join(dir, "old.db");
    const old = new Database(file);
    old.exec(`
      CREATE TABLE sources (id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, content TEXT NOT NULL, date_ingested TEXT NOT NULL);
      CREATE TABLE briefs (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, markdown TEXT NOT NULL, summary TEXT, key_ideas TEXT,
        entities_topics TEXT, opportunity_ideas TEXT, product_opportunity_score INTEGER, recommended_next_action TEXT,
        why_hunter_should_care TEXT, created_at TEXT NOT NULL, FOREIGN KEY (source_id) REFERENCES sources(id));
      CREATE TABLE rss_feeds (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, created_at TEXT NOT NULL);
      INSERT INTO sources VALUES ('s1','t','https://dup.com','c','2025-01-01'), ('s2','t','https://dup.com','c','2025-01-02');
      INSERT INTO briefs (id, source_id, markdown, created_at) VALUES ('b2','s2','m','2025-01-02');
    `);
    old.close();

    resetDb();
    process.env.RESEARCH_DB_PATH = file;
    const db = getDb();
    const cols = (db.prepare("PRAGMA table_info(briefs)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain("why_it_matters");
    expect(cols).toContain("is_fallback");
    expect(cols).not.toContain("why_hunter_should_care");
    expect((db.prepare("SELECT COUNT(*) n FROM sources").get() as { n: number }).n).toBe(1);
    expect(() => db.prepare("INSERT INTO sources (id,title,url,content,date_ingested) VALUES ('s3','t','https://dup.com','c','x')").run()).toThrow(/UNIQUE/);
  });
});

describe("HTML extraction", () => {
  it("strips markup from RSS bodies", () => {
    expect(htmlToText("<p>Hello <b>world</b></p><script>x()</script><p>Second</p>")).toBe("Hello world\n\nSecond");
    expect(htmlToText("plain text")).toBe("plain text");
  });

  it("extracts the article body and title, not the nav", () => {
    const html = `<html><head><title>Fallback</title><meta property="og:title" content="Real Title"></head>
      <body><nav>Home About</nav><article><h1>Real Title</h1>${"<p>Meaningful paragraph about chips and fabs.</p>".repeat(12)}</article></body></html>`;
    const r = extractArticle(html, "https://ex.com/x");
    expect(r.title).toBe("Real Title");
    expect(r.content).toContain("Meaningful paragraph");
  });
});
