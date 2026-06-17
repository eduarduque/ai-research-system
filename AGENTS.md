# AGENTS.md

This file describes how AI agents were used to build this project and how future agents should work within it.

## How This Project Was Built

This MVP was built entirely with **Claude Code** (claude.ai/code), an agentic AI coding assistant. The agent:

1. Read `PRD.md`, `ARCHITECTURE.md`, and `TASKS.md` from the research pack
2. Scaffolded the Next.js project and installed all dependencies
3. Implemented all API routes, pages, database layer, and documentation
4. Followed the TASKS.md build sequence (Phase 0 → Phase 8)

## Agent Instructions for Future Work

If you are an AI agent continuing work on this project:

### Priorities (in order)
1. Security — never expose secrets, never hardcode API keys
2. Working features over architecture — a clean, running prototype beats a complex half-built system
3. PRD requirements — see `PRD.md` for the feature checklist and scoring rubric
4. Simplicity — do not add abstractions that aren't needed

### Key Files
- `src/lib/db.ts` — SQLite database connection and all CRUD helpers
- `src/lib/types.ts` — TypeScript types for Source, Brief, RssFeed, GraphNode, GraphEdge
- `src/app/api/` — all API route handlers
- `src/app/` — all Next.js pages
- `data/research.db` — SQLite database (auto-created, do not commit)
- `.env.local` — secrets (gitignored, do not commit)

### Rules
- Run `npm run dev` to start the dev server before testing UI changes
- All API routes use the Next.js App Router `route.ts` convention
- `better-sqlite3` is a native module — it must stay in `serverExternalPackages` in `next.config.ts`
- The `GraphView.tsx` component must stay as `"use client"` — React Flow requires browser APIs
- Keep `SETUP_LOG.md` and `CHANGELOG.md` updated after each meaningful change
- Do not add Slack OAuth unless core features are fully working

### What's Not Built Yet (Future Work)
- Vector embeddings for semantic RAG (see SETUP_LOG.md for the tradeoff note)
- Real Slack OAuth with `@slack/bolt`
- Delete/archive from library UI
- Duplicate URL detection on ingest
- Deployment configuration (Vercel, Railway)
