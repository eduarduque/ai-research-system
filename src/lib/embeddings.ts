import OpenAI from "openai";

function getEmbeddingClient(): { client: OpenAI; model: string } | null {
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: "text-embedding-3-small",
    };
  }
  // Ollama supports OpenAI-compatible /v1/embeddings — use nomic-embed-text (274MB, very fast)
  if (process.env.OLLAMA_MODEL || process.env.OLLAMA_BASE_URL) {
    const base = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    return {
      client: new OpenAI({ apiKey: "ollama", baseURL: `${base}/v1` }),
      model: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
    };
  }
  return null;
}

export async function embedText(text: string): Promise<number[]> {
  const ec = getEmbeddingClient();
  if (!ec) throw new Error("No embedding provider configured");
  const res = await ec.client.embeddings.create({
    model: ec.model,
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  // Different providers produce different vector dimensions — return 0 rather than corrupt results
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
