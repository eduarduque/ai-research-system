import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "research.db");

declare global {
  // eslint-disable-next-line no-var
  var _db: Database.Database | undefined;
}

function getDb(): Database.Database {
  if (!global._db) {
    global._db = new Database(DB_PATH);
    global._db.pragma("journal_mode = WAL");
    initSchema(global._db);
  }
  return global._db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      content TEXT NOT NULL,
      date_ingested TEXT NOT NULL
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
      why_hunter_should_care TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES sources(id)
    );

    CREATE TABLE IF NOT EXISTS rss_feeds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const row = db
    .prepare("SELECT COUNT(*) as count FROM rss_feeds")
    .get() as { count: number };
  if (row.count === 0) {
    const insert = db.prepare(
      "INSERT INTO rss_feeds (id, name, url, created_at) VALUES (?, ?, ?, ?)"
    );
    const now = new Date().toISOString();
    const feeds = [
      { id: "feed-openai", name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml" },
      { id: "feed-anthropic", name: "Anthropic News", url: "https://www.anthropic.com/rss.xml" },
      { id: "feed-hn", name: "Hacker News", url: "https://news.ycombinator.com/rss" },
      { id: "feed-tc", name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
    ];
    for (const f of feeds) {
      insert.run(f.id, f.name, f.url, now);
    }
  }
}

// Sources
export function getSources() {
  return getDb().prepare("SELECT * FROM sources ORDER BY date_ingested DESC").all();
}

export function getSourceById(id: string) {
  return getDb().prepare("SELECT * FROM sources WHERE id = ?").get(id);
}

export function insertSource(source: {
  id: string;
  title: string;
  url: string;
  content: string;
  date_ingested: string;
}) {
  getDb()
    .prepare(
      "INSERT INTO sources (id, title, url, content, date_ingested) VALUES (@id, @title, @url, @content, @date_ingested)"
    )
    .run(source);
}

// Briefs
export function getBriefs() {
  return getDb()
    .prepare(
      `SELECT briefs.*, sources.title as source_title, sources.url as source_url
       FROM briefs
       JOIN sources ON briefs.source_id = sources.id
       ORDER BY briefs.created_at DESC`
    )
    .all();
}

export function getBriefById(id: string) {
  return getDb()
    .prepare(
      `SELECT briefs.*, sources.title as source_title, sources.url as source_url
       FROM briefs
       JOIN sources ON briefs.source_id = sources.id
       WHERE briefs.id = ?`
    )
    .get(id);
}

export function getBriefBySourceId(sourceId: string) {
  return getDb()
    .prepare("SELECT * FROM briefs WHERE source_id = ?")
    .get(sourceId);
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
  why_hunter_should_care: string;
  created_at: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO briefs
        (id, source_id, markdown, summary, key_ideas, entities_topics,
         opportunity_ideas, product_opportunity_score, recommended_next_action,
         why_hunter_should_care, created_at)
       VALUES
        (@id, @source_id, @markdown, @summary, @key_ideas, @entities_topics,
         @opportunity_ideas, @product_opportunity_score, @recommended_next_action,
         @why_hunter_should_care, @created_at)`
    )
    .run(brief);
}

// RSS feeds
export function getRssFeeds() {
  return getDb().prepare("SELECT * FROM rss_feeds ORDER BY name ASC").all();
}

export default getDb;
