// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/auth/login/route";
import {
  GATE_COOKIE,
  SESSION_COOKIE,
  verifyGateToken,
  verifySessionToken,
} from "@/lib/session";

const ORIGINAL_ENV = { ...process.env };

function request(password: unknown, ip: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ password }),
  });
}

function cookieValue(response: Response, name: string): string | undefined {
  const header = response.headers.get("set-cookie") ?? "";
  for (const part of header.split(/,(?=[^;]+=)/)) {
    const [pair] = part.trim().split(";");
    const [key, ...rest] = pair.split("=");
    if (key.trim() === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

beforeEach(() => {
  process.env.AUTH_PASSWORD = "correct-horse";
  process.env.AUTH_SECRET = "test-secret";
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_AUTH_MOCK;
  delete process.env.GOOGLE_ALLOWED_DOMAIN;
  delete process.env.VERCEL_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("POST /api/auth/login (password mode)", () => {
  it("rejects an incorrect password", async () => {
    const response = await POST(request("wrong", "203.0.113.11"));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/incorrect/i);
  });

  it("rejects a missing body", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("sets a password-only session cookie", async () => {
    const response = await POST(request("correct-horse", "203.0.113.12"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, stage: "app" });

    const token = cookieValue(response, SESSION_COOKIE);
    expect(token).toBeTruthy();
    const session = await verifySessionToken(token, "test-secret");
    expect(session?.email).toBeNull();
    expect(cookieValue(response, GATE_COOKIE)).toBeUndefined();
    expect(response.headers.get("set-cookie") ?? "").toContain("HttpOnly");
  });
});

describe("POST /api/auth/login (Google mode)", () => {
  it("issues only a short-lived password gate", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";

    const response = await POST(request("correct-horse", "203.0.113.13"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, stage: "google" });
    expect(cookieValue(response, SESSION_COOKIE)).toBeUndefined();

    const gate = cookieValue(response, GATE_COOKIE);
    expect(gate).toBeTruthy();
    await expect(verifyGateToken(gate, "test-secret")).resolves.toBe(true);
  });

  it("issues a gate in local mock mode", async () => {
    process.env.GOOGLE_AUTH_MOCK = "1";

    const response = await POST(request("correct-horse", "203.0.113.14"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ stage: "google" });
    expect(cookieValue(response, GATE_COOKIE)).toBeTruthy();
  });
});
