import { NextRequest, NextResponse } from "next/server";
import { generateBrief } from "@/lib/briefs";

export async function POST(req: NextRequest) {
  try {
    const { source_id } = await req.json();
    if (!source_id) {
      return NextResponse.json({ error: "source_id is required" }, { status: 400 });
    }

    const brief = await generateBrief(source_id);
    return NextResponse.json(brief, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "Source not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("briefs/generate error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
