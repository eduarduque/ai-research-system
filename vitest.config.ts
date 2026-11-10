import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Every test file gets its own in-memory DB and no AI/embedding provider unless it opts in.
    env: {
      RESEARCH_DB_PATH: ":memory:",
      EMBEDDING_PROVIDER: "none",
      OPENAI_API_KEY: "",
      GROQ_API_KEY: "",
      OLLAMA_MODEL: "",
      OLLAMA_BASE_URL: "",
      BROWSER_SCRAPE: "false",
      SEED_ON_BOOT: "false",
    },
  },
});
