import { NextRequest, NextResponse } from "next/server";
import { getSourceById, deleteSource } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const source = getSourceById(id);
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(source);
}

/** Delete a source together with its brief and retrieval chunks. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!deleteSource(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
