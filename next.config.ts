import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / heavy Node modules must not be bundled by Next.
  serverExternalPackages: ["better-sqlite3", "puppeteer-core", "@huggingface/transformers", "onnxruntime-node"],
  // Docker builds set NEXT_OUTPUT=standalone for a minimal runtime image; `npm start` uses the regular build.
  ...(process.env.NEXT_OUTPUT === "standalone" && { output: "standalone" as const }),
};

export default nextConfig;
