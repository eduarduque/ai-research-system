# AI Research Intelligence System

A local-first MVP that captures AI research from URLs and RSS feeds, generates AI research briefs, supports RAG-based search across saved research, and visualizes topic relationships in a knowledge graph.

## Features

- **URL Ingestion** — paste any article URL to extract and save content
- **RSS Feeds** — browse OpenAI Blog, Anthropic News, Hacker News, TechCrunch AI
- **AI Research Briefs** — auto-generated structured briefs with summary, key ideas, entities, opportunity score, and next action
- **Research Library** — browse all saved sources and briefs
- **RAG Search** — ask questions across saved research, get cited answers
- **Knowledge Graph** — interactive React Flow graph connecting sources → topics → opportunities
- **Slack Stub** — documented `/research [URL]` command flow + live API endpoint

## Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS
- SQLite via `better-sqlite3`
- OpenAI API (`gpt-4o-mini`)
- `@xyflow/react` (React Flow) for the knowledge graph
- `rss-parser` for RSS ingestion
- `cheerio` + `@mozilla/readability` for article extraction

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Add your OpenAI API key
cp .env.example .env.local
# Edit .env.local and set OPENAI_API_KEY

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The SQLite database is auto-created at `data/research.db` on first run. Four RSS feeds are seeded automatically.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes (soft) | OpenAI API key. If missing, brief generation uses a deterministic fallback. |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini` |

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard with stats and quick actions |
| `/ingest` | Paste a URL to ingest |
| `/rss` | Browse RSS feeds and ingest items |
| `/library` | All saved sources and briefs |
| `/briefs/[id]` | Full brief detail view |
| `/ask` | Ask questions across saved research |
| `/graph` | Knowledge graph visualization |
| `/slack` | Slack integration stub |

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/ingest/url` | Ingest a URL |
| GET | `/api/sources` | List all sources |
| POST | `/api/briefs/generate` | Generate a brief for a source |
| GET | `/api/briefs` | List all briefs |
| GET | `/api/rss/feeds` | List RSS feeds |
| POST | `/api/rss/fetch` | Fetch items from a feed |
| POST | `/api/rss/ingest` | Save an RSS item as a source |
| POST | `/api/ask` | RAG question answering |
| GET | `/api/graph` | Graph nodes and edges |
| POST | `/api/slack/research` | Slack stub endpoint |

## What I Built

Full MVP covering all Level 1 and Level 2 requirements from the PRD. URL and RSS ingestion work end-to-end. AI briefs are generated with structured JSON from OpenAI and rendered as rich cards. RAG search uses keyword scoring + LLM synthesis. The knowledge graph uses React Flow with color-coded node types. Slack stub is documented and the endpoint is live.

## What I Would Improve Next

- Add vector embeddings (LanceDB or Chroma) for semantic RAG instead of keyword scoring
- Delete/archive sources from the library UI
- Deploy to Vercel or Railway with a persistent volume for SQLite
- Implement real Slack OAuth with `@slack/bolt`
- Add duplicate URL detection before ingesting

## What I Did Not Build and Why

- **Real-time monitoring / n8n automation** — out of scope per PRD; future architecture idea
- **Full-text enterprise portal** — PRD explicitly says don't build
- **Multi-user auth** — not required for MVP, would add significant complexity
- **Vector embeddings** — keyword search is documented as acceptable MVP fallback in ARCHITECTURE.md

## How I Used AI Agents

Built entirely with Claude Code (claude.ai/code), which read the PRD, ARCHITECTURE.md, and TASKS.md then scaffolded and implemented all phases end-to-end.
