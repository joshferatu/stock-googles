import { NextResponse, type NextRequest } from "next/server";

import {
  authConfig,
  cookieOptions,
  createSessionToken,
  GATE_COOKIE,
  isAllowedGoogleEmail,
  safeNextPath,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyGateToken,
} from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Local/E2E only. `googleAuthConfig` disables mock mode on Vercel production,
 * so this route returns 404 there even if the env var is set by mistake.
 */
export async function POST(request: NextRequest) {
  const config = authConfig();
  if (!config.google.mock) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!config.secret) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 500 });
  }

  if (config.passwordGate) {
    const gate = await verifyGateToken(
      request.cookies.get(GATE_COOKIE)?.value,
      config.secret,
    );
    if (!gate) {
      return NextResponse.json({ error: "Password step required." }, { status: 401 });
    }
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    next?: string;
  } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isAllowedGoogleEmail(email, config.google.allowedDomain)) {
    return NextResponse.json(
      { error: `Use an @${config.google.allowedDomain} email address.` },
      { status: 400 },
    );
  }

  const next = safeNextPath(body?.next);
  const { token } = await createSessionToken(config.secret, {
    email,
    name: "Private Alpha tester",
  });
  const response = NextResponse.json({ ok: true, email, next });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  response.cookies.set(GATE_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}
