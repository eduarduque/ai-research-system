import { NextRequest, NextResponse } from "next/server";
import { getBriefById } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = getBriefById(id);
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(brief);
}
