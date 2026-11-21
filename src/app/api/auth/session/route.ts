import { NextResponse } from "next/server";

import { authConfig, SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const config = authConfig();
  if (!config.enabled) {
    return NextResponse.json({ required: false, authenticated: true });
  }
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const authenticated = await verifySessionToken(cookie, config.secret);
  return NextResponse.json({ required: true, authenticated });
}
