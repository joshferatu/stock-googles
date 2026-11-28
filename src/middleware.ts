import { NextResponse, type NextRequest } from "next/server";

import { authConfig, safeNextPath, SESSION_COOKIE, verifySessionToken } from "./lib/session";

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
  const authenticated = Boolean(session?.email);
  const next = nextQuery(request.nextUrl.searchParams.get("next"));

  if (pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (pathname === "/offline" || pathname === "/privacy") return NextResponse.next();

  if (pathname === "/login") {
    if (authenticated) return redirect(request, "/");
    // Google SSO is the only gate, so the legacy password URL forwards here.
    return redirect(request, `/login/google${next}`);
  }

  if (pathname === "/login/google") {
    if (!config.sso) return redirect(request, "/");
    if (authenticated) return redirect(request, "/");
    return NextResponse.next();
  }

  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return redirect(request, `/login${nextQuery(`${pathname}${search}`)}`);
}

export const config = {
  matcher: [
    // Everything except Next.js internals, static assets and the PWA manifest.
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|icon.png|icons/|manifest.webmanifest|sw.js|robots.txt).*)",
  ],
};
