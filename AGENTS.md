# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository. The project was built with Claude Code; see `docs/history/` for the original PRD and build log.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Lint / typecheck | `npm run lint` · `npm run typecheck` |
| Unit + integration tests | `npm test` (Vitest, in-memory SQLite, no network or AI keys needed) |
| Retrieval eval (no LLM) | `npm run eval -- --retrieval-only` |
| Full eval (needs a provider) | `npm run eval` |
| MCP server | `npm run mcp` |

Run `npm run lint && npm run typecheck && npm test` before committing. If you change retrieval, chunking, prompts or embeddings, run the eval and update `evals/RESULTS.md` with the new numbers — do not tune parameters without reporting the sweep.

## Layout

- `src/lib/` — the engine. API routes, the MCP server and the Slack bot are thin wrappers around it; never duplicate engine logic in a caller.
  - `ingest.ts` (`ingestUrl`, `saveSource` — the single write path for sources), `url.ts` (canonicalization + SSRF guard)
  - `chunk.ts`, `indexing.ts`, `embeddings.ts`, `retrieval.ts` (pure ranking), `ask.ts` (answers + citation repair)
  - `briefs.ts` (prompt, Zod schema, fallback), `graph.ts`, `discover.ts`, `db.ts` (schema, migrations, queries)
- `src/proxy.ts` — optional access token + rate limiting (Next 16 renamed middleware to proxy)
- `src/mcp/server.ts` — runs outside Next via `tsx`, so it uses relative imports, not `@/*`
- `tests/` — Vitest; `evals/` — fixture corpus, questions and the eval runner
- `docs/ARCHITECTURE.md` — design and trade-offs

## Rules

- Security first: never commit secrets; keep the SSRF guard (`safeFetch`) on every server-side fetch of a user-supplied URL.
- Native modules (`better-sqlite3`, `onnxruntime-node`, `@huggingface/transformers`, `puppeteer-core`) must stay in `serverExternalPackages`.
- Schema changes go in `initSchema()` as idempotent migrations, with a test in `tests/engine.test.ts`.
- `GraphView.tsx` must stay a client component (React Flow needs the DOM).
- Keep `CHANGELOG.md` updated for user-visible changes.
- This is Next.js 16: APIs differ from older versions. Read `node_modules/next/dist/docs/` before using an unfamiliar API.

## Not built yet

- Remote (HTTP) transport for the MCP server
- Multi-user accounts (the access token is single-tenant)
- A hosted vector index (`sqlite-vec` / pgvector) for libraries beyond tens of thousands of chunks
