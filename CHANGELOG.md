# CHANGELOG

## [1.0.0] — 2026-06-02

### Added

- Next.js 16 App Router project scaffold with TypeScript + Tailwind CSS
- SQLite database (`data/research.db`) with `sources`, `briefs`, `rss_feeds` tables
- Four starter RSS feeds seeded on first run (OpenAI, Anthropic, Hacker News, TechCrunch AI)
- `POST /api/ingest/url` — fetch and extract article content using Cheerio + Readability
- `POST /api/briefs/generate` — generate structured research brief via OpenAI `gpt-4o-mini`
- Deterministic brief fallback when no API key is configured
- `POST /api/rss/fetch` — parse any RSS feed and return items
- `POST /api/rss/ingest` — save an RSS item as a source
- `POST /api/ask` — keyword-based RAG search with LLM synthesis and source attribution
- `GET /api/graph` — generate knowledge graph nodes/edges from briefs
- `POST /api/slack/research` — Slack stub endpoint
- Dashboard page with stats and quick actions
- Ingest URL page with inline brief generation flow
- RSS Feeds page with feed selector and item list
- Research Library page listing all sources and briefs
- Brief Detail page with structured card layout (summary, key ideas, entities, score, action)
- Ask Research page with answer + source display
- Knowledge Graph page with React Flow visualization (color-coded node types, minimap, controls)
- Slack stub page with command flow documentation and setup instructions
- Left sidebar navigation
- `.env.example` with required environment variables
- `README.md`, `PRD.md`, `ARCHITECTURE.md`, `AGENTS.md`, `SETUP_LOG.md`, `CHANGELOG.md`
