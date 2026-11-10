import { NextResponse } from "next/server";
import { countSources } from "@/lib/db";
import { getAIClient } from "@/lib/ai";
import { getEmbeddingModelId } from "@/lib/embeddings";

export const dynamic = "force-dynamic";

/** Liveness + configuration summary (no secrets) for deploy health checks. */
export async function GET() {
  const ai = getAIClient();
  return NextResponse.json({
    ok: true,
    sources: countSources(),
    llm: ai ? { provider: ai.provider, model: ai.model } : null,
    embeddings: getEmbeddingModelId(),
  });
}
