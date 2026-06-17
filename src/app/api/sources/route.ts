import { NextResponse } from "next/server";
import { getSources } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getSources());
}
