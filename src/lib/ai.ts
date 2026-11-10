import OpenAI from "openai";

export type AIProvider = "openai" | "groq" | "ollama" | "none";

// The SDK retries 408/409/429/5xx with exponential backoff and honours Retry-After.
// Free tiers (Groq) rate-limit aggressively, so allow more attempts than the default 2.
const maxRetries = Number(process.env.AI_MAX_RETRIES ?? 4);

/**
 * Completion-budget options. Reasoning models (gpt-oss, o-series) spend a variable
 * share of the budget thinking before they answer: too small a cap truncates the
 * output to nothing, too large a cap gets the request rejected outright (HTTP 413)
 * on token-per-minute-limited tiers like Groq free, which counts the cap up front.
 * Low reasoning effort keeps both latency and the needed budget small.
 */
export function reasoningOptions(model: string, maxTokens = 4000) {
  const isReasoning = /gpt-oss|^o\d/i.test(model);
  return {
    max_completion_tokens: Number(process.env.AI_MAX_COMPLETION_TOKENS) || maxTokens,
    ...(isReasoning && { reasoning_effort: (process.env.AI_REASONING_EFFORT || "low") as "low" | "medium" | "high" }),
  };
}

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
