import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestUrl, IngestError } from "@/lib/ingest";
import { parseBody } from "@/lib/http";

const Body = z.object({ url: z.string().trim().min(1, "url is required").max(2048) });

export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, Body);
  if (error) return error;
  try {
    const { source, alreadyResearched } = await ingestUrl(data.url);
    return NextResponse.json(
      { ...source, already_researched: alreadyResearched },
      { status: alreadyResearched ? 200 : 201 }
    );
  } catch (err) {
    if (err instanceof IngestError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("ingest/url error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
