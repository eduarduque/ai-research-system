import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion } from "@/lib/ask";
import { parseBody } from "@/lib/http";

const Body = z.object({ question: z.string().trim().min(1, "question is required").max(2000) });

export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, Body);
  if (error) return error;
  try {
    return NextResponse.json(await answerQuestion(data.question));
  } catch (err) {
    console.error("ask error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
