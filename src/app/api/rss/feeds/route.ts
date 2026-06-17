import { NextResponse } from "next/server";
import { getRssFeeds } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getRssFeeds());
}
