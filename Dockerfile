# syntax=docker/dockerfile:1

# ── deps: native modules (better-sqlite3, onnxruntime) need a toolchain ──
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── build ──
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN npm run build
# Bake the embedding model into the image so the container works offline.
RUN MODEL_CACHE_DIR=/app/.cache/models node -e "import('@huggingface/transformers').then(async ({pipeline, env}) => { env.cacheDir = process.env.MODEL_CACHE_DIR; await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' }); })"

# ── runtime ──
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data MODEL_CACHE_DIR=/app/.cache/models BROWSER_SCRAPE=false
RUN groupadd --system app && useradd --system --gid app app && mkdir -p /app/data && chown app:app /app/data
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/.cache/models ./.cache/models
USER app
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
