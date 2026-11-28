// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authConfig,
  createOAuthStateToken,
  createPkcePair,
  createSessionToken,
  isAllowedGoogleEmail,
  randomToken,
  readCookie,
  safeNextPath,
  timingSafeEqual,
  verifyOAuthStateToken,
  verifySessionToken,
} from "@/lib/session";

const SECRET = "a-very-secret-value";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session tokens", () => {
  it("round-trips a Google session with an email", async () => {
    const { token } = await createSessionToken(SECRET, {
      email: "alpha@gmail.com",
      name: "Alpha Tester",
    });
    const session = await verifySessionToken(token, SECRET);
    expect(session?.email).toBe("alpha@gmail.com");
    expect(session?.name).toBe("Alpha Tester");
  });

  it("rejects signed tokens without an email (retired password gate)", async () => {
    const token = await createOAuthStateToken(SECRET, {
      state: "state-123",
      verifier: "verifier-456",
      next: "/",
    });
    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });

  it("rejects malformed, tampered, expired and wrong-secret tokens", async () => {
    const { token } = await createSessionToken(SECRET, { email: "alpha@gmail.com" });
    await expect(verifySessionToken(undefined, SECRET)).resolves.toBeNull();
    await expect(verifySessionToken("not-a-token", SECRET)).resolves.toBeNull();
    await expect(verifySessionToken(`${token}x`, SECRET)).resolves.toBeNull();
    await expect(verifySessionToken(token, "wrong-secret")).resolves.toBeNull();

    const expired = await createSessionToken(SECRET, { email: "alpha@gmail.com" }, -60);
    await expect(verifySessionToken(expired.token, SECRET)).resolves.toBeNull();

    // Old v1 cookies must not be accepted after the auth change.
    await expect(verifySessionToken("v1.9999999999999.abc", SECRET)).resolves.toBeNull();
  });
});

describe("OAuth state and PKCE", () => {
  it("round-trips state, verifier and next path", async () => {
    const token = await createOAuthStateToken(SECRET, {
      state: "state-123",
      verifier: "verifier-456",
      next: "/favorites",
    });
    const payload = await verifyOAuthStateToken(token, SECRET);
    expect(payload).toMatchObject({
      state: "state-123",
      verifier: "verifier-456",
      next: "/favorites",
    });
    await expect(verifyOAuthStateToken(token, "wrong-secret")).resolves.toBeNull();
  });

  it("creates S256 verifier/challenge pairs", async () => {
    const { verifier, challenge } = await createPkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    const again = await createPkcePair();
    expect(again.verifier).not.toBe(verifier);
    expect(randomToken()).not.toBe(randomToken());
  });
});

describe("Google email policy", () => {
  it("accepts only the configured domain", () => {
    expect(isAllowedGoogleEmail("alpha@gmail.com", "gmail.com")).toBe(true);
    expect(isAllowedGoogleEmail("ALPHA@GMAIL.COM", "gmail.com")).toBe(true);
    expect(isAllowedGoogleEmail("alpha+test@gmail.com", "gmail.com")).toBe(true);
    expect(isAllowedGoogleEmail("alpha@company.com", "gmail.com")).toBe(false);
    expect(isAllowedGoogleEmail("alpha@googlemail.com", "gmail.com")).toBe(false);
    expect(isAllowedGoogleEmail("not-an-email", "gmail.com")).toBe(false);
    expect(isAllowedGoogleEmail(null, "gmail.com")).toBe(false);
  });
});

describe("authConfig", () => {
  function clearAuthEnv() {
    delete process.env.AUTH_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_AUTH_MOCK;
    delete process.env.GOOGLE_ALLOWED_DOMAIN;
    vi.stubEnv("VERCEL_ENV", "");
  }

  it("is open when nothing is configured", () => {
    clearAuthEnv();
    expect(authConfig().mode).toBe("open");
    expect(authConfig().enabled).toBe(false);
    expect(authConfig().secret).toBe("");
  });

  it("has no password mode any more", () => {
    clearAuthEnv();
    process.env.AUTH_SECRET = "secret";
    // A leftover AUTH_PASSWORD must not open a gate.
    process.env.AUTH_PASSWORD = "pass";
    const config = authConfig();
    expect(config.mode).toBe("open");
    expect(config.secret).toBe("secret");
    delete process.env.AUTH_PASSWORD;
  });

  it("uses Google when credentials are set", () => {
    clearAuthEnv();
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    const config = authConfig();
    expect(config.mode).toBe("google");
    expect(config.sso).toBe(true);
    expect(config.google.allowedDomain).toBe("gmail.com");
  });

  it("falls back to the client secret for signing when AUTH_SECRET is unset", () => {
    clearAuthEnv();
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    expect(authConfig().secret).toBe("stock-googles:client-secret");
  });

  it("enables mock SSO locally but never on Vercel production", () => {
    clearAuthEnv();
    process.env.GOOGLE_AUTH_MOCK = "1";
    expect(authConfig().mode).toBe("mock");
    expect(authConfig().secret).toBeTruthy();

    vi.stubEnv("VERCEL_ENV", "production");
    expect(authConfig().mode).toBe("open");
  });
});

describe("safeNextPath", () => {
  it("allows only local paths", () => {
    expect(safeNextPath("/favorites?sort=change")).toBe("/favorites?sort=change");
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
  });
});

describe("readCookie", () => {
  it("reads a named cookie from a plain Request", () => {
    const request = new Request("http://localhost/api/user/state", {
      headers: { cookie: "a=1; sg_session=abc%2Edef; b=2" },
    });
    expect(readCookie(request, "sg_session")).toBe("abc.def");
    expect(readCookie(request, "missing")).toBeUndefined();
    expect(readCookie(new Request("http://localhost/"), "sg_session")).toBeUndefined();
  });
});

describe("timingSafeEqual", () => {
  it("compares without length leaks", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });
});
