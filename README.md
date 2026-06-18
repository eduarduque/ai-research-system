# AI Research Intelligence System

A local research tool that ingests articles and RSS feeds, generates AI-powered research briefs, lets you ask questions across your saved research, and visualizes topic connections in a knowledge graph.

Works entirely on your machine. No cloud database, no subscription, no account required — just paste a URL, get a brief.

---

## What It Does

- **Ingest any URL** — paste an article link, the app fetches and extracts the full text (handles JavaScript-rendered pages automatically using your local Chrome)
- **RSS feeds** — browse Hacker News, TechCrunch AI, VentureBeat AI, The Verge AI, MIT Technology Review — one click to save any item
- **AI Research Briefs** — structured analysis: summary, key ideas, entities, why it matters, opportunity areas, relevance score, next action
- **Research Library** — all saved articles and their briefs in one place
- **Ask questions** — type a question, get an answer citing your saved articles by source
- **Knowledge Graph** — visual map of how your sources connect through shared topics

---

## Prerequisites

- [Node.js 20+](https://nodejs.org/) — required
- Google Chrome — required for scraping JavaScript-rendered pages (most computers already have it)
- An AI provider — pick one from the options below (at least one is needed for real briefs)

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/eduarduque/ai-research-system.git
cd ai-research-system
npm install

# 2. Set up your AI provider (see section below)
cp .env.example .env.local
# Edit .env.local and uncomment one provider

# 3. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Five RSS feeds are seeded automatically on first run.

---

## Choosing an AI Provider

Open `.env.local` and uncomment **one** of these options. The app uses whichever is configured first.

### Option A — Groq (recommended: free, fast, 2-minute setup)

No credit card. No download. Sign up at [console.groq.com](https://console.groq.com), create an API key, paste it in `.env.local`:

```env
GROQ_API_KEY=gsk_...
```

That's it. Uses Llama 3.1 8B with a generous free tier.

---

### Option B — Ollama (local, free forever, works offline)

Runs a language model on your own machine. One-time setup:

1. Install Ollama from [ollama.com/download](https://ollama.com/download)
2. Open a terminal and pull the models:

```bash
# Chat model — best instruction following on a laptop (4.7 GB)
ollama pull qwen2.5:7b

# Embedding model — powers semantic search (274 MB)
ollama pull nomic-embed-text
```

3. Add to `.env.local`:

```env
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

Ollama starts automatically at `http://localhost:11434`. No API key needed.

**Already have a different model?** Any instruction-tuned model works. Just set `OLLAMA_MODEL=your-model-name`.

---

### Option C — OpenAI (paid, highest quality)

```env
OPENAI_API_KEY=sk-proj-...
```

Get a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Uses `gpt-4o-mini` by default.

---

### No AI provider

The app still works — URL ingestion, RSS, library, graph all function normally. Brief generation falls back to a basic template without real analysis.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | — | Groq API key (free tier available) |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Groq model name |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model name |
| `OLLAMA_MODEL` | — | Ollama model name, e.g. `qwen2.5:7b` |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama embedding model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `DATA_DIR` | `./data` | Directory for the SQLite database |

---

## Pages

| Route | What it does |
|---|---|
| `/` | Dashboard — stats and quick actions |
| `/ingest` | Paste any URL to save and extract content |
| `/rss` | Browse RSS feeds and save items |
| `/library` | All saved sources with brief generation |
| `/briefs/[id]` | Full brief for a source |
| `/ask` | Ask questions across your saved research |
| `/graph` | Knowledge graph of sources and topics |
| `/slack` | Slack integration stub and API docs |

---

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

## Stack

- **Next.js 16** — App Router, TypeScript, Tailwind CSS
- **SQLite** via `better-sqlite3` — local database, auto-created on first run
- **Puppeteer Core** — headless Chrome for JavaScript-rendered pages
- **OpenAI SDK** — used for all three AI providers (OpenAI, Groq, Ollama share the same API format)
- **Vector embeddings** — semantic search via OpenAI `text-embedding-3-small` or Ollama `nomic-embed-text`
- **React Flow** (`@xyflow/react`) — knowledge graph visualization
- **rss-parser**, **cheerio**, **@mozilla/readability** — content extraction

---

## Notes

- The SQLite database lives at `data/research.db` and persists between restarts
- Chrome must be installed for JavaScript-rendered pages (openai.com, etc.) — the app falls back to plain fetch for regular sites
- Embeddings are generated on ingest and used for semantic search in `/ask` — if no embedding provider is configured, search falls back to keyword matching
- Brief generation uses a two-step extract-then-analyze prompt to minimize hallucination
