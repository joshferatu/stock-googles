import { ProviderError } from "@/lib/errors";

/** Minimal Google OIDC helpers (authorization code + PKCE). */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const TIMEOUT_MS = 10_000;

export class GoogleAuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GoogleAuthError";
    this.code = code;
  }
}

export function getBaseUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) return `${forwardedProto ?? "https"}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export function googleRedirectUri(request: Request): string {
  return `${getBaseUrl(request)}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl({
  clientId,
  redirectUri,
  state,
  challenge,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    access_type: "online",
    include_granted_scopes: "true",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleTokens {
  accessToken: string;
  idToken: string | null;
}

export async function exchangeGoogleCode({
  clientId,
  clientSecret,
  code,
  redirectUri,
  verifier,
}: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  verifier: string;
}): Promise<GoogleTokens> {
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new GoogleAuthError("exchange", "Could not reach Google.");
  }

  if (!response.ok) {
    throw new GoogleAuthError("exchange", `Google token exchange failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!payload.access_token) {
    throw new GoogleAuthError(
      "exchange",
      payload.error_description ?? payload.error ?? "Google returned no access token.",
    );
  }
  return { accessToken: payload.access_token, idToken: payload.id_token ?? null };
}

export interface GoogleUser {
  email: string;
  emailVerified: boolean;
  name: string | null;
  hostedDomain: string | null;
}

export async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
  let response: Response;
  try {
    response = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new GoogleAuthError("userinfo", "Could not reach Google.");
  }

  if (!response.ok) {
    throw new ProviderError(`Google userinfo failed (${response.status})`, 502);
  }

  const payload = (await response.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
    hd?: string;
  };
  if (!payload.email) {
    throw new GoogleAuthError("userinfo", "Google returned no email address.");
  }
  return {
    email: payload.email.trim().toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name?.trim() || null,
    hostedDomain: payload.hd?.trim().toLowerCase() || null,
  };
}

export function googleErrorMessage(code: string | null | undefined): string | null {
  switch (code) {
    case "state":
      return "That sign-in attempt expired or was tampered with. Please try again.";
    case "denied":
      return "Google sign-in was cancelled.";
    case "domain":
      return "Only @gmail.com accounts are accepted during the Private Alpha.";
    case "unverified":
      return "Google has not verified that email address.";
    case "exchange":
      return "Google sign-in could not be completed. Please try again.";
    case "userinfo":
      return "Google did not return an account email. Please try again.";
    case "config":
      return "Google SSO is not configured on this deployment.";
    default:
      return null;
  }
}
