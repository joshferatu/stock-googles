// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as callback } from "@/app/api/auth/google/callback/route";
import { POST as mockGoogle } from "@/app/api/auth/google/mock/route";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  fetchGoogleUser,
  getBaseUrl,
  GoogleAuthError,
} from "@/lib/google";
import {
  createOAuthStateToken,
  OAUTH_COOKIE,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/session";

const ORIGINAL_ENV = { ...process.env };

function setGoogleEnv() {
  process.env.AUTH_SECRET = "test-secret";
  process.env.GOOGLE_CLIENT_ID = "client-id";
  process.env.GOOGLE_CLIENT_SECRET = "client-secret";
  delete process.env.GOOGLE_AUTH_MOCK;
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_SITE_URL;
}

function cookieValue(response: Response, name: string): string | undefined {
  const header = response.headers.get("set-cookie") ?? "";
  const match = new RegExp(`${name}=([^;]*)`).exec(header);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function mockGoogleFetch(userinfo: Record<string, unknown>, tokenStatus = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        if (tokenStatus !== 200) {
          return new Response(JSON.stringify({ error: "invalid_grant" }), {
            status: tokenStatus,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ access_token: "access-token", id_token: "id-token" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("openidconnect.googleapis.com/v1/userinfo")) {
        return new Response(JSON.stringify(userinfo), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    }),
  );
}

beforeEach(() => {
  setGoogleEnv();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("Google helpers", () => {
  it("derives the base URL from env, forwarded headers or the request", () => {
    const request = new NextRequest("http://localhost/api/auth/google/start");
    expect(getBaseUrl(request)).toBe("http://localhost");

    const forwarded = new NextRequest("http://localhost/api/auth/google/start", {
      headers: { "x-forwarded-host": "stock.example", "x-forwarded-proto": "https" },
    });
    expect(getBaseUrl(forwarded)).toBe("https://stock.example");

    process.env.NEXT_PUBLIC_SITE_URL = "https://stock-googles.vercel.app/";
    expect(getBaseUrl(request)).toBe("https://stock-googles.vercel.app");
  });

  it("builds an authorization URL with PKCE and account selection", () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: "client-id",
        redirectUri: "https://example.com/api/auth/google/callback",
        state: "state-123",
        challenge: "challenge-456",
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });

  it("exchanges an authorization code and reads the userinfo email", async () => {
    mockGoogleFetch({ email: "alpha@gmail.com", email_verified: true, name: "Alpha" });
    const tokens = await exchangeGoogleCode({
      clientId: "client-id",
      clientSecret: "client-secret",
      code: "code",
      redirectUri: "http://localhost/api/auth/google/callback",
      verifier: "verifier",
    });
    expect(tokens.accessToken).toBe("access-token");

    const user = await fetchGoogleUser(tokens.accessToken);
    expect(user).toMatchObject({
      email: "alpha@gmail.com",
      emailVerified: true,
      name: "Alpha",
    });
  });

  it("maps token failures to a GoogleAuthError", async () => {
    mockGoogleFetch({}, 400);
    await expect(
      exchangeGoogleCode({
        clientId: "client-id",
        clientSecret: "client-secret",
        code: "code",
        redirectUri: "http://localhost/api/auth/google/callback",
        verifier: "verifier",
      }),
    ).rejects.toBeInstanceOf(GoogleAuthError);
  });
});

describe("GET /api/auth/google/callback", () => {
  async function callbackRequest(userinfo: Record<string, unknown>, options?: { badState?: boolean }) {
    const state = "state-abc";
    const oauthToken = await createOAuthStateToken("test-secret", {
      state,
      verifier: "verifier-abc",
      next: "/favorites",
    });
    mockGoogleFetch(userinfo);
    return new NextRequest(
      `http://localhost/api/auth/google/callback?code=code-123&state=${options?.badState ? "wrong" : state}`,
      { headers: { cookie: `${OAUTH_COOKIE}=${encodeURIComponent(oauthToken)}` } },
    );
  }

  it("issues a full session for a verified gmail account", async () => {
    const response = await callback(
      await callbackRequest({ email: "alpha@gmail.com", email_verified: true, name: "Alpha" }),
    );

    expect([302, 307]).toContain(response.status);
    expect(response.headers.get("location")).toBe("http://localhost/favorites");

    const token = cookieValue(response, SESSION_COOKIE);
    expect(token).toBeTruthy();
    const session = await verifySessionToken(token, "test-secret");
    expect(session?.email).toBe("alpha@gmail.com");
    expect(session?.name).toBe("Alpha");
  });

  it("rejects a mismatched OAuth state", async () => {
    const response = await callback(
      await callbackRequest(
        { email: "alpha@gmail.com", email_verified: true },
        { badState: true },
      ),
    );
    expect(response.headers.get("location")).toContain("error=state");
    expect(cookieValue(response, SESSION_COOKIE)).toBeUndefined();
  });

  it("rejects non-gmail accounts", async () => {
    const response = await callback(
      await callbackRequest({ email: "alpha@company.com", email_verified: true }),
    );
    expect(response.headers.get("location")).toContain("error=domain");
    expect(cookieValue(response, SESSION_COOKIE)).toBeUndefined();
  });

  it("rejects unverified emails", async () => {
    const response = await callback(
      await callbackRequest({ email: "alpha@gmail.com", email_verified: false }),
    );
    expect(response.headers.get("location")).toContain("error=unverified");
  });

  it("reports provider cancellations", async () => {
    const response = await callback(
      new NextRequest("http://localhost/api/auth/google/callback?error=access_denied"),
    );
    expect(response.headers.get("location")).toContain("error=denied");
  });
});

describe("POST /api/auth/google/mock", () => {
  beforeEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_AUTH_MOCK = "1";
    delete process.env.VERCEL_ENV;
  });

  async function mockRequest(email: string) {
    return new NextRequest("http://localhost/api/auth/google/mock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next: "/favorites" }),
    });
  }

  it("issues a session for a gmail address", async () => {
    const response = await mockGoogle(await mockRequest("alpha@gmail.com"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, email: "alpha@gmail.com" });

    const session = await verifySessionToken(
      cookieValue(response, SESSION_COOKIE),
      "test-secret",
    );
    expect(session?.email).toBe("alpha@gmail.com");
  });

  it("rejects other domains", async () => {
    const response = await mockGoogle(await mockRequest("alpha@company.com"));
    expect(response.status).toBe(400);
  });

  it("is unavailable when mock mode is off", async () => {
    delete process.env.GOOGLE_AUTH_MOCK;
    const response = await mockGoogle(await mockRequest("alpha@gmail.com"));
    expect(response.status).toBe(404);
  });
});
