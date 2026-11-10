import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, sessionValue, safeEqual } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = process.env.APP_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ ok: true });

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || !safeEqual(password, token)) {
    return NextResponse.json({ error: "Wrong access token" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await sessionValue(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
