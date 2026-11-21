/**
 * Stateless session tokens: `v1.<expiresAtMs>.<hmac>`.
 * Uses Web Crypto only, so it runs in middleware (edge) and Node alike.
 */

export const SESSION_COOKIE = "sg_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

export function authConfig() {
  const password = process.env.AUTH_PASSWORD?.trim() ?? "";
  const secret = process.env.AUTH_SECRET?.trim() || (password ? `stock-googles:${password}` : "");
  return { enabled: password.length > 0, password, secret };
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Length-independent comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(
  secret: string,
  ttlSeconds = SESSION_MAX_AGE_SECONDS,
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload = `v1.${expiresAt}`;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return { token: `${payload}.${toBase64Url(new Uint8Array(signature))}`, expiresAt };
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  const payload = `v1.${expiresAt}`;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  const expectedToken = `${payload}.${toBase64Url(new Uint8Array(signature))}`;
  return timingSafeEqual(expectedToken, token);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Only allow same-site relative redirects. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}
