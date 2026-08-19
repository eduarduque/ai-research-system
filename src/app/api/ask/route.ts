import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/ask";

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const result = await answerQuestion(question);
    return NextResponse.json(result);
  } catch (err) {
    console.error("ask error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
