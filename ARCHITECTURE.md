# ARCHITECTURE.md

## Architecture goal

Build a simple, local-first MVP that demonstrates the research intelligence workflow without becoming a full production monitoring platform.

## Recommended MVP stack

- Framework: Next.js with TypeScript
- Styling: Tailwind CSS
- Database: SQLite
- Scraping: Cheerio plus Readability, or Playwright only if needed
- RSS: rss-parser
- AI: OpenAI API or compatible LLM API
- Search: simple keyword search first, embeddings if time allows
- Graph: React Flow or Cytoscape.js
- Slack: documented stub, basic endpoint optional

## System modules

### 1. Ingestion module

Responsibilities:

- Accept URL input
- Fetch page HTML
- Extract title and readable text
- Save source record
- Handle fetch errors clearly

Minimum source shape:

```ts
type Source = {
  id: string;
  title: string;
  url: string;
  content: string;
  date_ingested: string;
};
```

### 2. RSS module

Responsibilities:

- Store or define RSS feed URLs
- Fetch recent items
- Let user ingest one selected item
- Convert RSS item into a source record

Suggested starter feeds:

- OpenAI Blog
- Anthropic News
- Hacker News
- TechCrunch AI

### 3. Brief generation module

Responsibilities:

- Take source content
- Generate the required research brief format
- Save the brief linked to the source
- Extract topics, entities, and opportunities from the brief if possible

Suggested brief type:

```ts
type Brief = {
  id: string;
  source_id: string;
  summary: string;
  key_ideas: string[];
  entities_topics: string[];
  why_hunter_should_care: string;
  opportunity_ideas: string[];
  product_opportunity_score: number;
  recommended_next_action: string;
  markdown: string;
  created_at: string;
};
```

### 4. Research library module

Responsibilities:

- List saved sources and briefs
- Show detail view
- Provide filters or search
- Make demo data easy to understand

### 5. RAG search module

MVP approach:

1. Store source content and brief markdown.
2. When the user asks a question, retrieve the most relevant saved records.
3. Send the question plus top records to the LLM.
4. Return answer and sources used.

Fallback approach:

- Use keyword search if embeddings are not implemented.
- Document this in `SETUP_LOG.md`.

Answer format:

```md
## Answer
Clear answer based on saved research.

## Sources Used
- Source 1
- Source 2
```

### 6. Knowledge graph module

Responsibilities:

- Create graph nodes from sources, topics, entities, and opportunities.
- Create edges from source to topic, topic to entity, and topic to opportunity.
- Render the graph visually.

Suggested node type:

```ts
type GraphNode = {
  id: string;
  label: string;
  type: 'source' | 'topic' | 'entity' | 'opportunity';
};
```

Suggested edge type:

```ts
type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};
```

### 7. Slack module

MVP stub:

- Add a page or markdown section explaining `/research [URL]`.
- Show request and response example.

Optional basic endpoint:

```text
POST /api/slack/research
body: { url: string }
```

Response:

```text
Research item received. View it in the dashboard.
```

## Database design

Use SQLite for MVP.

Suggested tables:

```sql
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  content TEXT NOT NULL,
  date_ingested TEXT NOT NULL
);

CREATE TABLE briefs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  markdown TEXT NOT NULL,
  summary TEXT,
  key_ideas TEXT,
  entities_topics TEXT,
  opportunity_ideas TEXT,
  product_opportunity_score INTEGER,
  recommended_next_action TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE TABLE rss_feeds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

Optional graph tables can be generated from briefs instead of permanently stored.

## Suggested pages

- `/`: dashboard
- `/ingest`: URL ingestion
- `/rss`: RSS feed ingestion
- `/library`: saved research library
- `/briefs/[id]`: brief detail
- `/ask`: RAG search
- `/graph`: knowledge graph
- `/slack`: Slack stub documentation

## API route ideas

- `POST /api/ingest/url`
- `GET /api/sources`
- `GET /api/sources/:id`
- `POST /api/briefs/generate`
- `GET /api/briefs`
- `POST /api/rss/fetch`
- `POST /api/rss/ingest`
- `POST /api/ask`
- `GET /api/graph`
- `POST /api/slack/research`, optional

## Cost controls

- Only call the LLM after content is extracted and saved.
- Limit source content sent to the LLM.
- Use one brief generation call per ingested source.
- Use top few sources for RAG, not the whole database.
- Include fallback behavior if no API key is configured.

## Future architecture ideas, not MVP

The larger strategy docs mention real-time monitoring, n8n, Supabase, Telegram digests, source scoring, clustering, patents, social monitoring, and self-expanding agents.

These are future ideas. Do not build them before the core Hunter build test works.
