import OpenAI from "openai";
import path from "path";

export type EmbeddingProvider = "openai" | "ollama" | "local" | "none";

const LOCAL_MODEL = process.env.LOCAL_EMBED_MODEL || "Xenova/all-MiniLM-L6-v2";

/**
 * Which embedding backend to use. Explicit EMBEDDING_PROVIDER wins; otherwise
 * OpenAI → Ollama → a free local model that runs in-process (transformers.js,
 * ~23 MB, downloaded once). Groq has no embeddings API, so Groq users get the
 * local model — semantic search works with zero paid keys.
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  const explicit = process.env.EMBEDDING_PROVIDER?.toLowerCase();
  if (explicit === "openai" || explicit === "ollama" || explicit === "local" || explicit === "none") {
    return explicit;
  }
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.OLLAMA_MODEL || process.env.OLLAMA_BASE_URL) return "ollama";
  return "local";
}

/**
 * Stable identifier stored next to every vector. Vectors from different models
 * live in different spaces (and often different dimensions), so retrieval only
 * ever compares vectors that share this id.
 */
export function getEmbeddingModelId(): string | null {
  switch (getEmbeddingProvider()) {
    case "openai":
      return `openai:${process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small"}`;
    case "ollama":
      return `ollama:${process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text"}`;
    case "local":
      return `local:${LOCAL_MODEL}`;
    default:
      return null;
  }
}

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;
let localExtractor: Promise<Extractor> | null = null;

async function getLocalExtractor(): Promise<Extractor> {
  if (!localExtractor) {
    localExtractor = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = process.env.MODEL_CACHE_DIR || path.join(process.cwd(), ".cache", "models");
      return (await pipeline("feature-extraction", LOCAL_MODEL, { dtype: "q8" })) as unknown as Extractor;
    })().catch((err) => {
      localExtractor = null; // allow a retry after e.g. a transient download failure
      throw err;
    });
  }
  return localExtractor;
}

/** Embed a batch of texts with the configured provider. Throws if none is configured. */
export async function embedTexts(texts: string[]): Promise<{ vectors: number[][]; model: string }> {
  const provider = getEmbeddingProvider();
  const model = getEmbeddingModelId();
  if (!model || provider === "none") throw new Error("No embedding provider configured");
  if (texts.length === 0) return { vectors: [], model };

  if (provider === "local") {
    const extractor = await getLocalExtractor();
    const vectors: number[][] = [];
    // Small batches keep peak memory flat on long articles.
    for (let i = 0; i < texts.length; i += 16) {
      const out = await extractor(texts.slice(i, i + 16), { pooling: "mean", normalize: true });
      vectors.push(...out.tolist());
    }
    return { vectors, model };
  }

  const client =
    provider === "openai"
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : new OpenAI({ apiKey: "ollama", baseURL: `${process.env.OLLAMA_BASE_URL || "http://localhost:11434"}/v1` });
  const res = await client.embeddings.create({
    model: model.slice(model.indexOf(":") + 1),
    input: texts.map((t) => t.slice(0, 8000)),
  });
  return { vectors: res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding), model };
}

export async function embedText(text: string): Promise<{ vector: number[]; model: string }> {
  const { vectors, model } = await embedTexts([text]);
  return { vector: vectors[0], model };
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  // Vectors from different models can have different dimensions — never compare them.
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Vectors are stored as raw float32 BLOBs: ~4x smaller than JSON and no parse cost. */
export function vectorToBlob(v: number[]): Buffer {
  return Buffer.from(new Float32Array(v).buffer);
}

export function blobToVector(b: Buffer): Float32Array {
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
}
