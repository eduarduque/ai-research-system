export const AUTH_COOKIE = "ars_session";

/** Cookie value derived from the access token, so the raw token never sits in the browser. */
export async function sessionValue(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`ars:v1:${token}`));
  return Buffer.from(digest).toString("hex");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
