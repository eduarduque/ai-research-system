import { NextRequest, NextResponse } from "next/server";

// Slack stub — accepts a URL and returns the expected bot response.
// To wire up a real Slack bot: install @slack/bolt, add SLACK_BOT_TOKEN +
// SLACK_SIGNING_SECRET to .env.local, and handle the Events API payload.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body.url || body.text || "";
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    return NextResponse.json({
      response_type: "in_channel",
      text: `Research item received for: ${url}\nView it in the dashboard at /library.`,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
