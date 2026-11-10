import OpenAI from "openai";

export type AIProvider = "openai" | "groq" | "ollama" | "none";

// The SDK retries 408/409/429/5xx with exponential backoff and honours Retry-After.
// Free tiers (Groq) rate-limit aggressively, so allow more attempts than the default 2.
const maxRetries = Number(process.env.AI_MAX_RETRIES ?? 4);

export function getAIClient(): { client: OpenAI; model: string; provider: AIProvider } | null {
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries }),
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      provider: "openai",
    };
  }

  if (process.env.GROQ_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
        maxRetries,
      }),
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      provider: "groq",
    };
  }

  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  if (process.env.OLLAMA_MODEL || process.env.OLLAMA_BASE_URL) {
    return {
      client: new OpenAI({
        apiKey: "ollama",
        baseURL: `${ollamaUrl}/v1`,
        maxRetries,
      }),
      model: process.env.OLLAMA_MODEL || "mistral",
      provider: "ollama",
    };
  }

  return null;
}
