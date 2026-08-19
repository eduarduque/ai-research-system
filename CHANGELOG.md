# CHANGELOG

## [Unreleased]

### Added

- MCP server (`src/mcp/server.ts`, `npm run mcp`) exposing `ingest_url`, `ask_research`, `generate_brief`, `list_sources`, and `get_research_graph` as tools for Claude Desktop / Claude Code
- Project-scoped `.mcp.json` so the MCP tools are picked up automatically when this project is opened in Claude Code
- Real Slack Events endpoint (`src/app/api/slack/events/route.ts`), replacing the earlier stub
- `src/lib/ask.ts`, `src/lib/briefs.ts`, `src/lib/graph.ts`, `src/lib/ingest.ts` — core engine logic extracted out of the API route handlers so the MCP server and the web app call the same code instead of duplicating it
- README screenshots and environment variable reference table

### Changed

- Brief-generation prompt rewritten (extract-then-organize, entity validation, grounding rule) to reduce hallucination
- Groq and Ollama added as free alternatives to OpenAI

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
