// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  safeNextPath,
  timingSafeEqual,
  verifySessionToken,
} from "@/lib/session";

const SECRET = "a-very-secret-value";

describe("session tokens", () => {
  it("round-trips a valid token", async () => {
    const { token } = await createSessionToken(SECRET);
    expect(token.startsWith("v1.")).toBe(true);
    await expect(verifySessionToken(token, SECRET)).resolves.toBe(true);
  });

  it("rejects malformed, tampered and expired tokens", async () => {
    const { token } = await createSessionToken(SECRET);
    await expect(verifySessionToken(undefined, SECRET)).resolves.toBe(false);
    await expect(verifySessionToken("v1.abc", SECRET)).resolves.toBe(false);
    await expect(verifySessionToken(`${token}x`, SECRET)).resolves.toBe(false);
    await expect(verifySessionToken(token, "wrong-secret")).resolves.toBe(false);
    await expect(verifySessionToken("v2.9999999999999.abc", SECRET)).resolves.toBe(false);

    const expired = await createSessionToken(SECRET, -60);
    await expect(verifySessionToken(expired.token, SECRET)).resolves.toBe(false);
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

describe("timingSafeEqual", () => {
  it("compares without length leaks", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });
});
