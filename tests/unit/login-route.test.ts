// @vitest-environment node
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/auth/login/route";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

process.env.AUTH_PASSWORD = "correct-horse";
process.env.AUTH_SECRET = "test-secret";

function request(password: unknown, ip = "203.0.113.10") {
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

describe("POST /api/auth/login", () => {
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

  it("sets a verifiable session cookie for the right password", async () => {
    const response = await POST(request("correct-horse", "203.0.113.12"));
    expect(response.status).toBe(200);
    const token = cookieValue(response, SESSION_COOKIE);
    expect(token).toBeTruthy();
    await expect(verifySessionToken(token, "test-secret")).resolves.toBe(true);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
  });
});
