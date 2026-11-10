import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / heavy Node modules must not be bundled by Next.
  serverExternalPackages: ["better-sqlite3", "puppeteer-core", "@huggingface/transformers", "onnxruntime-node"],
  output: "standalone",
};

export default nextConfig;
