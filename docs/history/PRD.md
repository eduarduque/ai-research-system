# PRD.md

## Product name

AI Research Intelligence System

## Objective

Build a working MVP that captures AI research from URLs and RSS feeds, creates useful AI research briefs, saves sources and briefs, supports questions across saved research with RAG, visualizes relationships in a knowledge graph, and includes a Slack bot stub or basic integration.

This is a test of project setup, markdown documentation, fast MVP execution, UI clarity, AI-agent usage, and product judgment.

## Non-negotiable principle

Do not overbuild. A clean working prototype is better than a complicated half-built system.

## Target user

Hunter, XPM, XPM Labs, or a similar team that wants to quickly collect AI research signals and turn them into product or client strategy ideas.

## Core workflow

1. Capture research from a URL.
2. Capture research from an RSS feed.
3. Generate an AI research brief.
4. Save sources and briefs.
5. Ask questions against saved research using RAG.
6. Visualize relationships in a knowledge graph.
7. Include a Slack bot stub or basic integration for sending links into the system.

## Required features

### 1. URL scraper

The app must allow a user to paste a URL, extract page content, and save it as a source.

Minimum saved fields:

```json
{
  "title": "Page title",
  "url": "Source URL",
  "content": "Extracted text",
  "date_ingested": "Timestamp"
}
```

### 2. RSS feed integration

The app must allow a user to add or use at least one RSS feed, fetch recent items, and ingest one selected item.

Example feeds:

- OpenAI Blog
- Anthropic News
- Hacker News
- TechCrunch AI

The repo should document which feeds were used.

### 3. AI research brief generator

Each ingested item should generate:

```md
# Research Brief

## Source
Title + URL

## Summary
Short summary.

## Key Ideas
- Idea 1
- Idea 2
- Idea 3

## Entities / Topics
- Entity or topic 1
- Entity or topic 2
- Entity or topic 3

## Why Hunter Should Care
Practical relevance to XPM, XPM Labs, client strategy, AI systems, or product ideas.

## Opportunity Ideas
- Idea 1
- Idea 2
- Idea 3

## Product Opportunity Score
Score: 1 to 10

## Recommended Next Action
One clear next action.
```

### 4. RAG search

The app must allow a user to ask questions across saved research.

Minimum answer format:

```md
## Answer
Clear answer based on saved research.

## Sources Used
- Source 1
- Source 2
```

### 5. Knowledge graph visualization

Use one visual graph tool:

- React Flow
- Cytoscape.js
- Sigma.js
- D3.js

Recommended: React Flow or Cytoscape.js.

Minimum graph entities:

- Sources
- Topics
- Entities
- Opportunities

Minimum relationship structure:

```text
Source -> Topic
Topic -> Entity
Topic -> Opportunity
```

Bonus: clicking a graph node filters the research library.

### 6. Slack bot stub or basic integration

Include either:

#### Option A, stub

A documented Slack command flow showing how `/research [URL]` would work.

#### Option B, basic working integration

A Slack bot or command that accepts a URL and sends it to the app for ingestion.

Minimum expected bot behavior:

```text
/research https://example.com/article
Research item received. View it in the dashboard.
```

Do not spend too much time on Slack auth.

## Required markdown files

The repo must include:

1. `README.md`
2. `PRD.md`
3. `ARCHITECTURE.md`
4. `AGENTS.md`
5. `SETUP_LOG.md`
6. `CHANGELOG.md`

## Suggested tech stack

- Next.js
- Tailwind CSS
- OpenAI API
- SQLite
- Chroma, LanceDB, or simple vector search
- React Flow or Cytoscape.js
- RSS parser
- Cheerio, Readability, Playwright, or similar scraper
- Slack Bolt SDK for Slack bot stub or basic integration

## Build levels

### Level 1, pass

- URL ingestion works
- AI brief generation works
- Saved brief library exists
- Basic search works
- Simple knowledge graph works
- Required markdown files are included

### Level 2, strong

- RSS ingestion works
- RAG search works with sources
- Graph relationships are useful
- Dashboard UI is clean
- Setup process is clearly documented

### Level 3, excellent

- Slack bot accepts a URL
- Graph node clicks filter the library
- App is deployed or easily runnable
- Architecture docs are clear
- Setup log shows good debugging and tradeoff decisions

## Submission package

Prepare:

1. GitHub repo link
2. Live demo link if available
3. Two-minute Loom walkthrough
4. Short note answering:
   - What I built
   - What I would improve next
   - Where I got stuck
   - How I used AI agents
   - What I intentionally did not build and why

## Evaluation criteria

| Area | Score |
|---|---:|
| Project setup and repo hygiene | 1 to 5 |
| Markdown documentation and agent instructions | 1 to 5 |
| URL scraping | 1 to 5 |
| RSS ingestion | 1 to 5 |
| Research brief generation | 1 to 5 |
| RAG search | 1 to 5 |
| Knowledge graph visualization | 1 to 5 |
| Slack bot stub or integration | 1 to 5 |
| UI clarity and polish | 1 to 5 |
| Simplicity and judgment | 1 to 5 |

Passing score: 30 out of 50.

Strong score: 38 out of 50.

Excellent score: 44 or higher out of 50.
