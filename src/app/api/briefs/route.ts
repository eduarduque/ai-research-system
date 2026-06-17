import { NextResponse } from "next/server";
import { getBriefs } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getBriefs());
}
