import OpenAI from "openai";

export type AIProvider = "openai" | "groq" | "ollama" | "none";

export function getAIClient(): { client: OpenAI; model: string; provider: AIProvider } | null {
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      provider: "openai",
    };
  }

  if (process.env.GROQ_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      provider: "groq",
    };
  }

  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  if (process.env.OLLAMA_MODEL || process.env.OLLAMA_BASE_URL) {
    return {
      client: new OpenAI({
        apiKey: "ollama",
        baseURL: `${ollamaUrl}/v1`,
      }),
      model: process.env.OLLAMA_MODEL || "mistral",
      provider: "ollama",
    };
  }

  return null;
}
