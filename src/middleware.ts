import { NextResponse, type NextRequest } from "next/server";

import { authConfig, safeNextPath, SESSION_COOKIE, verifySessionToken } from "./lib/session";

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/",
  "/offline",
  "/manifest.webmanifest",
  "/sw.js",
  "/icons/",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const config = authConfig();
  const { pathname, search } = request.nextUrl;

  // No password configured: the app is open. (Single shared password, no accounts.)
  if (!config.enabled) {
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await verifySessionToken(token, config.secret);

  if (pathname === "/login") {
    if (authenticated) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (isPublic(pathname)) return NextResponse.next();

  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const loginUrl = new URL("/login", request.url);
  const next = safeNextPath(`${pathname}${search}`);
  if (next !== "/") loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Everything except Next.js internals, static assets and the PWA manifest.
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|icon.png|icons/|manifest.webmanifest|sw.js|robots.txt).*)",
  ],
};
