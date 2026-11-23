import { NextResponse, type NextRequest } from "next/server";

import {
  authConfig,
  GATE_COOKIE,
  safeNextPath,
  SESSION_COOKIE,
  verifyGateToken,
  verifySessionToken,
} from "./lib/session";

function redirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

function nextQuery(value: string | null): string {
  const next = safeNextPath(value);
  return next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
}

export async function middleware(request: NextRequest) {
  const config = authConfig();
  const { pathname, search } = request.nextUrl;

  if (config.mode === "open") {
    if (pathname.startsWith("/login")) return redirect(request, "/");
    return NextResponse.next();
  }

  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    config.secret,
  );
  // SSO sessions must carry a verified email; password-only sessions may not.
  const authenticated = Boolean(session) && (!config.sso || Boolean(session?.email));
  const gate = await verifyGateToken(request.cookies.get(GATE_COOKIE)?.value, config.secret);

  if (pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (pathname === "/offline") return NextResponse.next();

  if (pathname === "/login") {
    if (authenticated) return redirect(request, "/");
    if (config.sso) {
      // No password stage configured: go straight to Google.
      if (!config.passwordGate) {
        return redirect(request, `/login/google${nextQuery(request.nextUrl.searchParams.get("next"))}`);
      }
      // Password already accepted: continue to the Google step.
      if (gate) {
        return redirect(request, `/login/google${nextQuery(request.nextUrl.searchParams.get("next"))}`);
      }
    }
    return NextResponse.next();
  }

  if (pathname === "/login/google") {
    if (!config.sso) return redirect(request, "/login");
    if (authenticated) return redirect(request, "/");
    if (config.passwordGate && !gate) {
      return redirect(
        request,
        `/login${nextQuery(request.nextUrl.searchParams.get("next"))}`,
      );
    }
    return NextResponse.next();
  }

  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const next = safeNextPath(`${pathname}${search}`);
  return redirect(request, `/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`);
}

export const config = {
  matcher: [
    // Everything except Next.js internals, static assets and the PWA manifest.
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|icon.png|icons/|manifest.webmanifest|sw.js|robots.txt).*)",
  ],
};
