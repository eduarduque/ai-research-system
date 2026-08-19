import { NextRequest, NextResponse } from "next/server";
import { ingestUrl } from "@/lib/ingest";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const source = await ingestUrl(url);
    return NextResponse.json(source, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    const status = msg.startsWith("Failed to fetch") || msg.startsWith("Could not extract") ? 422 : 500;
    if (status === 500) console.error("ingest/url error:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
