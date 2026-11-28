// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/auth/session/route";
import { createSessionToken } from "@/lib/session";

const ORIGINAL_ENV = { ...process.env };
const SECRET = "test-secret";

function request(cookie?: string) {
  return new NextRequest("http://localhost/api/auth/session", {
    headers: cookie ? { cookie } : undefined,
  });
}

async function sessionBody(cookie?: string): Promise<Record<string, unknown>> {
  const response = await GET(request(cookie));
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  delete process.env.GOOGLE_AUTH_MOCK;
  delete process.env.VERCEL_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("GET /api/auth/session", () => {
  it("never allows the response to be cached", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.AUTH_SECRET = SECRET;

    const response = await GET(request());
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("reports an open deployment", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.AUTH_SECRET;

    const response = await GET(request());
    expect(await response.json()).toEqual({
      required: false,
      authenticated: true,
      email: null,
      name: null,
      mode: "open",
      sso: false,
    });
  });

  it("is unauthenticated without a session", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.AUTH_SECRET = SECRET;

    const body = await sessionBody();
    expect(body).toMatchObject({ required: true, authenticated: false, mode: "google" });
    expect(body.email).toBeNull();
  });

  it("returns the verified email for a valid session", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.AUTH_SECRET = SECRET;

    const { token } = await createSessionToken(SECRET, {
      email: "alpha@gmail.com",
      name: "Alpha",
    });
    const body = await sessionBody(`sg_session=${encodeURIComponent(token)}`);

    expect(body).toMatchObject({
      required: true,
      authenticated: true,
      email: "alpha@gmail.com",
      name: "Alpha",
    });
  });

  it("rejects a session signed with another secret", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.AUTH_SECRET = SECRET;

    const { token } = await createSessionToken("other-secret", { email: "alpha@gmail.com" });
    const body = await sessionBody(`sg_session=${encodeURIComponent(token)}`);

    expect(body.authenticated).toBe(false);
  });
});
