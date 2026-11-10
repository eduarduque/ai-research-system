import { NextResponse } from "next/server";
import { discoverLatest } from "@/lib/discover";

export async function POST() {
  try {
    const result = await discoverLatest();
    return NextResponse.json(result);
  } catch (err) {
    console.error("discover error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
