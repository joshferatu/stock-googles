import { NextResponse, type NextRequest } from "next/server";

import {
  exchangeGoogleCode,
  fetchGoogleUser,
  GoogleAuthError,
  googleRedirectUri,
} from "@/lib/google";
import {
  authConfig,
  cookieOptions,
  createSessionToken,
  isAllowedGoogleEmail,
  OAUTH_COOKIE,
  safeNextPath,
  SESSION_COOKIE,
  sessionCookieOptions,
  timingSafeEqual,
  verifyOAuthStateToken,
} from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = authConfig();
  const oauth = await verifyOAuthStateToken(
    request.cookies.get(OAUTH_COOKIE)?.value,
    config.secret,
  );

  const fail = (error: string) => {
    const target = new URL("/login/google", request.url);
    target.searchParams.set("error", error);
    if (oauth?.next && oauth.next !== "/") target.searchParams.set("next", oauth.next);
    const response = NextResponse.redirect(target);
    response.cookies.set(OAUTH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
    return response;
  };

  if (!config.google.enabled || !config.secret) return fail("config");

  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return fail(providerError === "access_denied" ? "denied" : "exchange");
  }

  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  if (!oauth || !state || !timingSafeEqual(oauth.state, state)) return fail("state");
  if (!code) return fail("exchange");

  try {
    const tokens = await exchangeGoogleCode({
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      code,
      redirectUri: googleRedirectUri(request),
      verifier: oauth.verifier,
    });
    const user = await fetchGoogleUser(tokens.accessToken);

    if (!user.emailVerified) return fail("unverified");
    if (!isAllowedGoogleEmail(user.email, config.google.allowedDomain)) return fail("domain");

    const { token } = await createSessionToken(config.secret, {
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.redirect(
      new URL(safeNextPath(oauth.next), request.url),
    );
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    response.cookies.set(OAUTH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
    return response;
  } catch (error) {
    return fail(error instanceof GoogleAuthError ? error.code : "exchange");
  }
}
