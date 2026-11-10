import { NextResponse } from "next/server";
import { z } from "zod";

/** Parse and validate a JSON request body; returns a 400 response on failure. */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T
): Promise<{ data: z.infer<T>; error?: never } | { data?: never; error: NextResponse }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { error: NextResponse.json({ error: "Request body must be JSON" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return { error: NextResponse.json({ error: msg }, { status: 400 }) };
  }
  return { data: parsed.data };
}
