# AI Research Intelligence System

A local-first MVP that captures AI research from URLs and RSS feeds, generates AI research briefs, supports RAG-based semantic search, and visualizes topic relationships in a knowledge graph.

## Features

- **URL Ingestion** — paste any article URL to extract and save content
- **RSS Feeds** — browse Hacker News, TechCrunch AI, VentureBeat AI, The Verge AI, MIT Technology Review
- **AI Research Briefs** — structured briefs with summary, key ideas, entities, opportunity score, and next action
- **Research Library** — browse all saved sources and briefs
- **RAG Search** — ask questions across saved research with vector semantic search and cited answers
- **Knowledge Graph** — interactive React Flow graph connecting sources → topics → opportunities
- **Slack Stub** — documented `/research [URL]` command flow + live API endpoint

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind CSS)
- SQLite via `better-sqlite3`
- `@xyflow/react` (React Flow) for the knowledge graph
- `rss-parser`, `cheerio`, `@mozilla/readability` for ingestion
- OpenAI SDK (also used for Groq and Ollama via compatible API)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Choose your AI provider (pick one)

The app works with **OpenAI**, **Groq** (free), or **Ollama** (local, free). Copy the example file and fill in one provider:

```bash
cp .env.example .env.local
```

---

#### Option A — OpenAI (paid, best quality)

```env
OPENAI_API_KEY=sk-proj-...
```

Get a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys). A few dollars of credit covers heavy use with `gpt-4o-mini`.

---

#### Option B — Groq (free cloud, 2-minute setup)

```env
GROQ_API_KEY=gsk_...
```

1. Sign up at [console.groq.com](https://console.groq.com)
2. Go to **API Keys** → create a key
3. Paste it in `.env.local` — done. No credit card needed.

Groq runs Llama 3.1 8B with a generous free tier (14,400 requests/day).

---

#### Option C — Ollama (local, free forever, no internet after setup)

1. **Install Ollama** — [ollama.com/download](https://ollama.com/download)

2. **Pull the models** (one-time download):

```bash
# Chat model — best JSON output on a laptop (4.7 GB)
ollama pull qwen2.5:7b

# Embedding model — semantic search (274 MB only)
ollama pull nomic-embed-text
```

3. **Add to `.env.local`**:

```env
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

Ollama starts automatically at `http://localhost:11434` when you run a model. No API key needed.

> **Already have a different model?** Any model that supports instruction following works. Just set `OLLAMA_MODEL=your-model-name`. `dolphin-llama3:8b`, `mistral`, and `llama3.1:8b` all work well.

---

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The SQLite database is auto-created at `data/research.db` on first run. Five RSS feeds are seeded automatically with the latest articles.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | OpenAI API key (provider priority 1) |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI chat model |
| `GROQ_API_KEY` | — | Groq API key (provider priority 2) |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Groq chat model |
| `OLLAMA_MODEL` | — | Ollama chat model name, e.g. `qwen2.5:7b` (provider priority 3) |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama embedding model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `DATA_DIR` | `./data` | SQLite database directory |

Only one provider is used at a time. The app checks: OpenAI → Groq → Ollama → deterministic fallback.

---

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

---

## What I Built

Full MVP covering all Level 1 and Level 2 requirements from the PRD. URL and RSS ingestion work end-to-end. AI briefs are generated with structured JSON and rendered as rich cards. RAG search uses vector embeddings (OpenAI or Ollama `nomic-embed-text`) with cosine similarity ranking and LLM synthesis. The knowledge graph uses React Flow with color-coded node types. Slack stub is documented and the endpoint is live.

## What I Would Improve Next

- Delete/archive sources from the library UI
- Deploy to Railway or Fly.io with a persistent volume for SQLite
- Implement real Slack OAuth with `@slack/bolt`
- Add duplicate URL detection before ingesting
- Streaming responses for brief generation

## What I Did Not Build and Why

- **Real-time monitoring / n8n automation** — out of scope per PRD; future architecture idea
- **Full-text enterprise portal** — PRD explicitly says don't build
- **Multi-user auth** — not required for MVP, adds significant complexity

## How I Used AI Agents

Built entirely with Claude Code (claude.ai/code), which read the PRD, ARCHITECTURE.md, and TASKS.md then scaffolded and implemented all phases end-to-end. AI also diagnosed and fixed issues during testing (RSS parsing, brief generation fallbacks, provider routing).
