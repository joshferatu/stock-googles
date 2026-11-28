import { NextResponse } from "next/server";

import { OAUTH_COOKIE, cookieOptions, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  response.cookies.set(OAUTH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}
