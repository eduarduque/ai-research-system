import { lookup } from "dns/promises";
import net from "net";

// Query params that only track the click, never change the content — stripping
// them is what makes "already researched" dedupe actually catch re-shares.
const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|dclid|mc_cid|mc_eid|ref|ref_src|igshid|si|_hsenc|_hsmi)$/i;

/**
 * Canonical form of a URL used for storage and duplicate detection.
 * Adds a missing scheme (share sheets often drop it), lowercases the host,
 * drops the fragment, tracking params and a trailing slash.
 */
export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const u = new URL(withScheme);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  }
  u.searchParams.sort();
  let out = u.toString();
  if (u.pathname !== "/" && out.endsWith("/") && !u.search) out = out.slice(0, -1);
  if (u.pathname === "/" && !u.search) out = out.replace(/\/$/, "");
  return out;
}

/** True for loopback, private, link-local (cloud metadata), CGNAT and other non-public ranges. */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
  }
  return true;
}

export class UnsafeUrlError extends Error {}

/**
 * SSRF guard: only http(s), and the host must resolve exclusively to public IPs.
 * Set ALLOW_PRIVATE_URLS=true to opt out (e.g. ingesting an intranet wiki locally).
 */
export async function assertPublicUrl(url: string): Promise<void> {
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new UnsafeUrlError(`Only http(s) URLs are allowed (got ${u.protocol})`);
  }
  if (process.env.ALLOW_PRIVATE_URLS === "true") return;

  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addrs.length === 0) throw new UnsafeUrlError(`Could not resolve host ${host}`);
  if (addrs.some(isPrivateIp)) {
    throw new UnsafeUrlError("URLs pointing at private or internal network addresses are not allowed");
  }
}

/**
 * fetch() that re-validates every redirect hop, so a public URL can't 302 the
 * server into its own network.
 */
export async function safeFetch(url: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}
