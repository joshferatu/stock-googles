import type { NextRequest } from "next/server";

import { jsonNoStore } from "@/lib/http";
import { authConfig, SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = authConfig();
  if (!config.enabled) {
    return jsonNoStore({
      required: false,
      authenticated: true,
      email: null,
      name: null,
      mode: "open",
      sso: false,
    });
  }

  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    config.secret,
  );

  return jsonNoStore({
    required: true,
    authenticated: Boolean(session?.email),
    email: session?.email ?? null,
    name: session?.name ?? null,
    mode: config.mode,
    sso: config.sso,
  });
}
