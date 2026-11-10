import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateBrief } from "@/lib/briefs";
import { parseBody } from "@/lib/http";

const Body = z.object({
  source_id: z.string().trim().min(1, "source_id is required"),
  // Regenerate even if an AI brief already exists.
  force: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, Body);
  if (error) return error;
  try {
    const brief = await generateBrief(data.source_id, { force: data.force });
    return NextResponse.json(brief, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Source not found") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("briefs/generate error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
