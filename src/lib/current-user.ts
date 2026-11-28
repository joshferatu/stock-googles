/**
 * Resolves the signed-in identity for user-owned data.
 *
 * The session cookie is the only source of identity: it is HMAC-signed and
 * carries the Google-verified email, so routes never trust client-supplied ids.
 */

import { authConfig, readCookie, SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/** Returns the verified email, or null when the request is not authenticated. */
export async function currentUserEmail(request: Request): Promise<string | null> {
  const { secret } = authConfig();
  const token = readCookie(request, SESSION_COOKIE);
  const session = await verifySessionToken(token, secret);
  return session?.email ?? null;
}
