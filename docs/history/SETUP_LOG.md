# SETUP_LOG.md

## Initial Setup — 2026-06-02

### What Was Built

Full MVP from scratch using `create-next-app@16` with TypeScript + Tailwind CSS.

### Commands Run

```bash
npx create-next-app@latest ai-research-system --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
npm install better-sqlite3 rss-parser cheerio @mozilla/readability jsdom openai @xyflow/react uuid
npm install --save-dev @types/better-sqlite3 @types/jsdom @types/uuid
```

### Architecture Decisions

**SQLite via better-sqlite3**
- Synchronous API is simple and works perfectly in Next.js API routes
- Added `serverExternalPackages: ["better-sqlite3"]` to `next.config.ts` so webpack doesn't try to bundle the native module
- Database stored at `data/research.db`, auto-created on first request
- Global singleton `global._db` prevents multiple connections during hot reload in dev

**Article Extraction**
- Used `jsdom` to create a DOM from fetched HTML, then passed to `@mozilla/readability`
- `cheerio` used as fallback for title extraction
- Content truncated at 20,000 chars for storage, 4,000 chars sent to LLM

**Brief Generation**
- Asked OpenAI to return `response_format: { type: "json_object" }` to guarantee parseable output
- Built markdown from the JSON fields rather than asking LLM to write markdown directly — more reliable parsing
- Deterministic fallback if `OPENAI_API_KEY` is not set

**RAG Search**
- Keyword scoring approach: split query into words, count matches in source title + content + brief summary
- Top 5 results sent to LLM with a synthesis prompt
- Documented tradeoff: keyword search is less accurate than vector embeddings but sufficient for MVP

**Knowledge Graph**
- React Flow (`@xyflow/react`) with custom node component
- Nodes generated dynamically from brief `entities_topics` and `opportunity_ideas` fields
- Edges: Source → Topic, Topic → Opportunity
- Graph page is a Server Component wrapping a `"use client"` `GraphView` component

**RSS Feeds**
- Four starter feeds seeded on first DB init: OpenAI Blog, Anthropic News, Hacker News, TechCrunch AI
- `rss-parser` handles XML parsing; `content:encoded` field checked first for full article text

### Problems Encountered

- `better-sqlite3` is a native Node.js module — webpack tries to bundle it by default. Fixed with `serverExternalPackages`.
- React Flow requires `"use client"` — solved by extracting `GraphView.tsx` as a client component, keeping the page itself as a Server Component.
- OpenAI RSS feed URL changed; using `https://openai.com/blog/rss.xml` (may need updating).

### Tradeoff Decisions

| Decision | Chosen | Alternative | Reason |
|---|---|---|---|
| Vector search | Keyword scoring | LanceDB/Chroma embeddings | Keyword is sufficient for MVP; embeddings add infra complexity |
| Slack | Stub + live endpoint | Full OAuth | Auth flow not worth the time per PRD guidance |
| DB | SQLite | PostgreSQL | Local-first, zero infra, easy to demo |
| Graph layout | Random initial positions | Dagre/ELK auto-layout | React Flow's `fitView` handles it well enough for MVP |

### What Was Intentionally Not Built

- Vector embeddings for semantic search
- Slack OAuth (full bot setup)
- Delete/archive from library UI
- Duplicate URL detection
- Real-time monitoring or background jobs
