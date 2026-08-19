import { NextResponse } from "next/server";
import { buildGraph } from "@/lib/graph";

export async function GET() {
  return NextResponse.json(buildGraph());
}
