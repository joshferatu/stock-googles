import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authConfig,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  timingSafeEqual,
} from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ password: z.string().max(200) });

const WINDOW_MS = 10 * 60_000;
const MAX_FAILURES = 8;
const failures = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function isLockedOut(key: string) {
  const entry = failures.get(key);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function registerFailure(key: string) {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || entry.resetAt < now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export async function POST(request: Request) {
  const config = authConfig();
  if (!config.enabled) {
    return NextResponse.json({ ok: true, required: false });
  }

  const key = clientKey(request);
  if (isLockedOut(key)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  if (!timingSafeEqual(parsed.data.password, config.password)) {
    registerFailure(key);
    await new Promise((resolve) => setTimeout(resolve, 350));
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  failures.delete(key);
  const { token } = await createSessionToken(config.secret);
  const response = NextResponse.json({ ok: true, required: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
