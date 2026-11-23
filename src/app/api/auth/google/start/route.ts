import { NextResponse, type NextRequest } from "next/server";

import { buildGoogleAuthUrl, googleRedirectUri } from "@/lib/google";
import {
  authConfig,
  cookieOptions,
  createOAuthStateToken,
  createPkcePair,
  GATE_COOKIE,
  OAUTH_COOKIE,
  OAUTH_MAX_AGE_SECONDS,
  randomToken,
  safeNextPath,
  verifyGateToken,
} from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function loginRedirect(request: NextRequest, error?: string) {
  const target = new URL("/login/google", request.url);
  if (error) target.searchParams.set("error", error);
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  const config = authConfig();
  if (!config.google.enabled || !config.secret) {
    return loginRedirect(request, "config");
  }

  if (config.passwordGate) {
    const gate = await verifyGateToken(
      request.cookies.get(GATE_COOKIE)?.value,
      config.secret,
    );
    if (!gate) return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = randomToken(24);
  const { verifier, challenge } = await createPkcePair();
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const oauthToken = await createOAuthStateToken(config.secret, { state, verifier, next });

  const redirectUri = googleRedirectUri(request);
  const response = NextResponse.redirect(
    buildGoogleAuthUrl({
      clientId: config.google.clientId,
      redirectUri,
      state,
      challenge,
    }),
  );
  response.cookies.set(OAUTH_COOKIE, oauthToken, cookieOptions(OAUTH_MAX_AGE_SECONDS));
  return response;
}
