import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

declare global {
  var _db: Database.Database | undefined;
}

/** DB location: RESEARCH_DB_PATH (file or ":memory:") > DATA_DIR/research.db > ./data/research.db */
function resolveDbPath(): string {
  if (process.env.RESEARCH_DB_PATH) return process.env.RESEARCH_DB_PATH;
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "research.db");
}

function getDb(): Database.Database {
  if (!global._db) {
    global._db = new Database(resolveDbPath());
    global._db.pragma("journal_mode = WAL");
    global._db.pragma("foreign_keys = ON");
    initSchema(global._db);
  }
  return global._db;
}

/** Close and forget the connection (used by tests and the eval harness to swap databases). */
export function resetDb() {
  global._db?.close();
  global._db = undefined;
}

export const DEFAULT_FEEDS = [
  { id: "feed-hn", name: "Hacker News", url: "https://news.ycombinator.com/rss" },
  { id: "feed-tc", name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { id: "feed-vb", name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/" },
  { id: "feed-verge", name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml" },
  { id: "feed-mittr", name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/" },
];

function hasColumn(db: Database.Database, table: string, col: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === col);
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      content TEXT NOT NULL,
      date_ingested TEXT NOT NULL,
      embedding TEXT
    );

    CREATE TABLE IF NOT EXISTS briefs (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      markdown TEXT NOT NULL,
      summary TEXT,
      key_ideas TEXT,
      entities_topics TEXT,
      opportunity_ideas TEXT,
      product_opportunity_score INTEGER,
      recommended_next_action TEXT,
      why_it_matters TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rss_feeds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Retrieval unit for RAG: each source is split into overlapping chunks and
    -- each chunk is embedded separately. 'model' records which embedding model
    -- produced the vector so mixed-model vectors are never compared.
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      idx INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding BLOB,
      model TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id);
    CREATE INDEX IF NOT EXISTS idx_briefs_source ON briefs(source_id);
  `);

  // ── Migrations for databases created by earlier versions ──
  if (!hasColumn(db, "sources", "embedding")) db.exec("ALTER TABLE sources ADD COLUMN embedding TEXT");
  if (hasColumn(db, "briefs", "why_hunter_should_care") && !hasColumn(db, "briefs", "why_it_matters")) {
    db.exec("ALTER TABLE briefs RENAME COLUMN why_hunter_should_care TO why_it_matters");
  }
  // Fallback (non-AI) briefs are flagged so the UI can label them and they can be regenerated.
  if (!hasColumn(db, "briefs", "is_fallback")) {
    db.exec("ALTER TABLE briefs ADD COLUMN is_fallback INTEGER NOT NULL DEFAULT 0");
  }
  // Enforce one source per URL. Older DBs may already contain duplicates; keep the
  // oldest row of each URL so the unique index can be created.
  db.exec(`
    DELETE FROM briefs WHERE source_id IN
      (SELECT id FROM sources WHERE rowid NOT IN (SELECT MIN(rowid) FROM sources GROUP BY url));
    DELETE FROM sources WHERE rowid NOT IN (SELECT MIN(rowid) FROM sources GROUP BY url);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_url ON sources(url);
  `);

  const row = db.prepare("SELECT COUNT(*) as count FROM rss_feeds").get() as { count: number };
  if (row.count === 0) {
    const insert = db.prepare("INSERT INTO rss_feeds (id, name, url, created_at) VALUES (?, ?, ?, ?)");
    const now = new Date().toISOString();
    for (const f of DEFAULT_FEEDS) insert.run(f.id, f.name, f.url, now);
  }
}

// ── Sources ──
export function getSources() {
  return getDb()
    .prepare("SELECT id, title, url, content, date_ingested FROM sources ORDER BY date_ingested DESC")
    .all();
}

export function getSourceById(id: string) {
  return getDb().prepare("SELECT id, title, url, content, date_ingested FROM sources WHERE id = ?").get(id);
}

export function getSourceByUrl(url: string) {
  return getDb().prepare("SELECT id, title, url, content, date_ingested FROM sources WHERE url = ?").get(url);
}

export function insertSource(source: { id: string; title: string; url: string; content: string; date_ingested: string }) {
  getDb()
    .prepare(
      "INSERT INTO sources (id, title, url, content, date_ingested) VALUES (@id, @title, @url, @content, @date_ingested)"
    )
    .run(source);
}

export function deleteSource(id: string): boolean {
  const db = getDb();
  // Explicit child deletes: briefs tables created by older versions have no ON DELETE CASCADE.
  return db.transaction(() => {
    db.prepare("DELETE FROM chunks WHERE source_id = ?").run(id);
    db.prepare("DELETE FROM briefs WHERE source_id = ?").run(id);
    return db.prepare("DELETE FROM sources WHERE id = ?").run(id).changes > 0;
  })();
}

export function countSources(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM sources").get() as { n: number }).n;
}

// ── Chunks ──
export type ChunkRow = {
  id: string;
  source_id: string;
  idx: number;
  text: string;
  embedding: Buffer | null;
  model: string | null;
  title: string;
  url: string;
};

export function replaceChunks(
  sourceId: string,
  chunks: { id: string; idx: number; text: string; embedding: Buffer | null; model: string | null }[]
) {
  const db = getDb();
  const del = db.prepare("DELETE FROM chunks WHERE source_id = ?");
  const ins = db.prepare(
    "INSERT INTO chunks (id, source_id, idx, text, embedding, model) VALUES (@id, @source_id, @idx, @text, @embedding, @model)"
  );
  db.transaction(() => {
    del.run(sourceId);
    for (const c of chunks) ins.run({ ...c, source_id: sourceId });
  })();
}

export function getAllChunks(): ChunkRow[] {
  return getDb()
    .prepare(
      `SELECT chunks.*, sources.title, sources.url
       FROM chunks JOIN sources ON chunks.source_id = sources.id`
    )
    .all() as ChunkRow[];
}

/** Sources with no chunks, or whose chunks were embedded by a different model than `model`. */
export function getSourcesNeedingIndex(model: string | null) {
  return getDb()
    .prepare(
      `SELECT s.id, s.title, s.url, s.content, s.date_ingested FROM sources s
       WHERE NOT EXISTS (SELECT 1 FROM chunks c WHERE c.source_id = s.id)
          OR (? IS NOT NULL AND EXISTS (
                SELECT 1 FROM chunks c WHERE c.source_id = s.id AND (c.model IS NULL OR c.model != ?)))`
    )
    .all(model, model);
}

// ── Briefs ──
const BRIEF_SELECT = `SELECT briefs.*, sources.title as source_title, sources.url as source_url
                      FROM briefs JOIN sources ON briefs.source_id = sources.id`;

export function getBriefs() {
  return getDb().prepare(`${BRIEF_SELECT} ORDER BY briefs.created_at DESC`).all();
}

export function getBriefById(id: string) {
  return getDb().prepare(`${BRIEF_SELECT} WHERE briefs.id = ?`).get(id);
}

export function getBriefBySourceId(sourceId: string) {
  return getDb().prepare("SELECT * FROM briefs WHERE source_id = ?").get(sourceId);
}

export function deleteBriefBySourceId(sourceId: string) {
  getDb().prepare("DELETE FROM briefs WHERE source_id = ?").run(sourceId);
}

export function insertBrief(brief: {
  id: string;
  source_id: string;
  markdown: string;
  summary: string;
  key_ideas: string;
  entities_topics: string;
  opportunity_ideas: string;
  product_opportunity_score: number;
  recommended_next_action: string;
  why_it_matters: string;
  is_fallback: number;
  created_at: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO briefs
        (id, source_id, markdown, summary, key_ideas, entities_topics,
         opportunity_ideas, product_opportunity_score, recommended_next_action,
         why_it_matters, is_fallback, created_at)
       VALUES
        (@id, @source_id, @markdown, @summary, @key_ideas, @entities_topics,
         @opportunity_ideas, @product_opportunity_score, @recommended_next_action,
         @why_it_matters, @is_fallback, @created_at)`
    )
    .run(brief);
}

// ── RSS feeds ──
export function getRssFeeds() {
  return getDb().prepare("SELECT * FROM rss_feeds ORDER BY name ASC").all();
}

export default getDb;
