/**
 * Auth primitives: signed tokens, cookies, Google OAuth config and PKCE.
 * Uses Web Crypto only, so it runs in middleware (edge) and Node routes.
 *
 * Flow: Google identity (authorization code + PKCE) -> full session.
 * Tokens are `base64url(JSON).base64url(HMAC-SHA256)`, so old cookies
 * invalidate automatically. Google SSO is the only way in.
 */

export const SESSION_COOKIE = "sg_session";
export const OAUTH_COOKIE = "sg_oauth";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const OAUTH_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

/**
 * Local/E2E signing key for mock mode, used only when both `AUTH_SECRET` and
 * the Google client secret are absent. Mock mode is impossible on Vercel
 * production, so this value never signs a real session.
 */
const MOCK_SECRET = "stock-googles:local-mock";

const encoder = new TextEncoder();

export type AuthMode = "open" | "google" | "mock";

export interface SessionData {
  /** Google-verified email. Every session carries one. */
  email: string;
  name?: string | null;
  exp: number;
}

export interface OAuthStateData {
  state: string;
  verifier: string;
  next: string;
  exp: number;
}

export interface GoogleAuthSettings {
  enabled: boolean;
  mock: boolean;
  clientId: string;
  clientSecret: string;
  allowedDomain: string;
}

export function googleAuthConfig(): GoogleAuthSettings {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const enabled = Boolean(clientId && clientSecret);
  // Mock mode is a local/E2E convenience. It is impossible on Vercel production
  // even if the variable is set by mistake.
  const mock =
    !enabled && process.env.GOOGLE_AUTH_MOCK === "1" && process.env.VERCEL_ENV !== "production";
  const allowedDomain = (process.env.GOOGLE_ALLOWED_DOMAIN?.trim() || "gmail.com")
    .replace(/^@/, "")
    .toLowerCase();

  return { enabled, mock, clientId, clientSecret, allowedDomain };
}

export function authConfig() {
  const google = googleAuthConfig();
  const mode: AuthMode = google.enabled ? "google" : google.mock ? "mock" : "open";
  const sso = google.enabled || google.mock;
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    (google.clientSecret ? `stock-googles:${google.clientSecret}` : "") ||
    (sso ? MOCK_SECRET : "");

  return { enabled: mode !== "open", secret, google, mode, sso };
}

/** Reads a cookie from a plain `Request` (route handlers and unit tests). */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(signature);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64UrlEncode(buffer);
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomToken(32);
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return { verifier, challenge: base64UrlEncode(new Uint8Array(digest)) };
}

async function signPayload(payload: { exp: number } & Record<string, unknown>, secret: string): Promise<string> {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await hmac(secret, body);
  return `${body}.${base64UrlEncode(signature)}`;
}

async function verifyPayload<T extends { exp: number }>(
  token: string | undefined,
  secret: string,
): Promise<T | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = base64UrlEncode(await hmac(secret, body));
  if (!timingSafeEqual(expected, signature)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body)) as T;
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSessionToken(
  secret: string,
  data: { email: string; name?: string | null },
  ttlSeconds = SESSION_MAX_AGE_SECONDS,
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const token = await signPayload(
    { exp: expiresAt, email: data.email, name: data.name ?? null },
    secret,
  );
  return { token, expiresAt };
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<SessionData | null> {
  const payload = await verifyPayload<SessionData>(token, secret);
  if (!payload) return null;
  // Sessions without an email (the retired password gate) are not identities.
  if (typeof payload.email !== "string" || !payload.email.trim()) return null;
  return payload;
}

export async function createOAuthStateToken(
  secret: string,
  data: { state: string; verifier: string; next: string },
  ttlSeconds = OAUTH_MAX_AGE_SECONDS,
): Promise<string> {
  return signPayload({ ...data, exp: Date.now() + ttlSeconds * 1000 }, secret);
}

export async function verifyOAuthStateToken(
  token: string | undefined,
  secret: string,
): Promise<OAuthStateData | null> {
  const payload = await verifyPayload<OAuthStateData>(token, secret);
  if (!payload || !payload.state || !payload.verifier) return null;
  return payload;
}

/** `gmail.com` (default) rejects Workspace/custom domains during the alpha. */
export function isAllowedGoogleEmail(email: string | null | undefined, domain: string): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(normalized)) return false;
  return normalized.endsWith(`@${domain.toLowerCase()}`);
}

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function sessionCookieOptions() {
  return cookieOptions(SESSION_MAX_AGE_SECONDS);
}

/** Only allow same-site relative redirects. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}
