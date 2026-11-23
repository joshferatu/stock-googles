import { NextResponse } from "next/server";

import {
  cookieOptions,
  GATE_COOKIE,
  OAUTH_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  response.cookies.set(GATE_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  response.cookies.set(OAUTH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}
