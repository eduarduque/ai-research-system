import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, sessionValue, safeEqual } from "@/lib/auth";
import { RateLimiter } from "@/lib/rate-limit";

// Endpoints that cost money (LLM / embedding calls) or do outbound fetches.
const EXPENSIVE = /^\/api\/(ingest|ask|briefs\/generate|discover|rss\/(fetch|ingest))/;
// Reachable without a session: login itself, health checks, and Slack (HMAC-verified in its route).
const PUBLIC = /^\/(login|api\/auth\/login|api\/health|api\/slack\/events)(\/|$)/;

const limiter = new RateLimiter(Number(process.env.RATE_LIMIT_PER_MIN) || 30);

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (req.method !== "GET" && EXPENSIVE.test(pathname)) {
    if (limiter.hit(clientIp(req)) < 0) {
      return NextResponse.json(
        { error: "Too many requests — slow down and try again in a minute." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // Access control is opt-in: set APP_ACCESS_TOKEN before exposing the app publicly.
  const token = process.env.APP_ACCESS_TOKEN;
  if (!token || PUBLIC.test(pathname)) return NextResponse.next();

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer && safeEqual(bearer, token)) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && safeEqual(cookie, await sessionValue(token))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
