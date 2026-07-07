# AI Research Intelligence System

A full-stack research pipeline that ingests articles and RSS feeds, generates structured AI briefs, answers questions using RAG with vector search, and maps topic relationships in a knowledge graph.

Built with Next.js 16, SQLite, and a provider-agnostic LLM layer (OpenAI, Groq, or Ollama).

---

## How It Works

### Ingestion Pipeline

```
URL / RSS item
      │
      ▼
 Scraper layer
 ├── Puppeteer (JS-rendered pages)
 └── Cheerio + Readability (static pages)
      │
      ▼
 Text extraction → stored in SQLite
      │
      ├──► Embedding model → vector stored alongside content
      │         (OpenAI text-embedding-3-small  OR  Ollama nomic-embed-text)
      │
      └──► Brief generator (on demand)
               Two-step LLM prompt: extract entities → analyze significance
               Output: summary, key ideas, entities, opportunity score, next action
```

### RAG Search Pipeline

```
User question
      │
      ▼
 Embed query  ──────────────────────────────────────────────────────────────┐
      │                                                                      │
      ▼                                                                      │
 Cosine similarity vs all stored embeddings  ←── SQLite (content + vectors) ┘
      │
      ▼
 Top-5 retrieval (falls back to keyword scoring if no embeddings)
      │
      ▼
 LLM synthesis prompt with retrieved context
      │
      ▼
 Cited answer  →  "## Answer … [1] [2]  ## Sources Used …"
```

### Knowledge Graph

Sources, topics, and entities extracted from briefs become graph nodes. Edges connect sources to their topics, topics to entities, and topics to opportunities — rendered with React Flow for visual exploration.

---

## Key Engineering Decisions

**Provider-agnostic LLM layer** — OpenAI, Groq (Llama 3.1), and Ollama all share the OpenAI SDK's `/v1/chat/completions` and `/v1/embeddings` interfaces. Switching providers is one env variable change with zero code changes.

**Cosine similarity in-process** — Embeddings are stored as JSON blobs in SQLite and similarity is computed in TypeScript. No vector database needed for this scale; the implementation is transparent and portable.

**Graceful degradation** — If no embedding provider is configured, RAG falls back to keyword scoring. If no LLM is configured, ingestion and the graph still work. Each layer is independent.

**Two-step brief generation** — Content is first extracted (structured fields), then analyzed (why it matters, opportunity score). Separating extraction from reasoning reduces hallucination and makes outputs consistent.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, App Router, TypeScript |
| Database | SQLite via `better-sqlite3` |
| Scraping | Puppeteer Core + Cheerio + @mozilla/readability |
| Embeddings | OpenAI `text-embedding-3-small` / Ollama `nomic-embed-text` |
| LLM | OpenAI SDK (shared interface for OpenAI, Groq, Ollama) |
| Graph UI | React Flow (`@xyflow/react`) |
| Content parsing | `rss-parser`, `cheerio`, `@mozilla/readability` |

---

## Quick Start

```bash
git clone https://github.com/eduarduque/ai-research-system.git
cd ai-research-system
npm install
cp .env.example .env.local
# Configure one AI provider (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Five RSS feeds are pre-seeded on first run.

---

## AI Provider Setup

Open `.env.local` and configure **one** provider. The app uses whichever key is present first.

### Groq — free, no credit card, 2-minute setup (recommended for trying it out)

Sign up at [console.groq.com](https://console.groq.com), create a key:

```env
GROQ_API_KEY=gsk_...
```

Uses Llama 3.1 8B. Generous free tier.

---

### Ollama — fully local, works offline

```bash
# Install from ollama.com/download, then:
ollama pull qwen2.5:7b          # chat model (4.7 GB)
ollama pull nomic-embed-text    # embedding model (274 MB)
```

```env
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

---

### OpenAI

```env
OPENAI_API_KEY=sk-proj-...
```

Uses `gpt-4o-mini` by default. Also enables `text-embedding-3-small` for semantic search.

---

### No provider

The app still works without an LLM — ingestion, RSS, library, and the knowledge graph all function. Brief generation falls back to a template; RAG falls back to keyword matching.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | — | Groq API key |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Groq model |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model |
| `OLLAMA_MODEL` | — | Ollama model (e.g. `qwen2.5:7b`) |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama embedding model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `DATA_DIR` | `./data` | SQLite database directory |

---

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — stats and quick actions |
| `/ingest` | Paste any URL to extract and save |
| `/rss` | Browse RSS feeds and save items |
| `/library` | All saved sources with brief generation |
| `/briefs/[id]` | Full structured brief for a source |
| `/ask` | RAG question answering over saved research |
| `/graph` | Knowledge graph of sources, topics, entities |
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

## Notes

- SQLite database auto-creates at `data/research.db` on first run
- Chrome must be installed for JS-rendered pages; the app falls back to plain fetch for static sites
- Embeddings are generated on ingest; if no embedding provider is set, `/ask` uses keyword matching
- Different embedding providers produce different vector dimensions — the cosine similarity function returns 0 for mismatched dimensions rather than producing incorrect results
