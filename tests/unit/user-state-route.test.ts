// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "@/app/api/user/state/route";
import { createSessionToken } from "@/lib/session";
import { MAX_FAVORITES } from "@/lib/user-state";

const readUserState = vi.fn();
const writeUserState = vi.fn();

vi.mock("@/lib/user-state-repo", () => ({
  readUserState: (...args: unknown[]) => readUserState(...args),
  writeUserState: (...args: unknown[]) => writeUserState(...args),
}));

const ORIGINAL_ENV = { ...process.env };
const SECRET = "test-secret";

async function request(method: string, body?: unknown, authenticated = true) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authenticated) {
    const { token } = await createSessionToken(SECRET, { email: "alpha@gmail.com" });
    headers.cookie = `sg_session=${encodeURIComponent(token)}`;
  }
  return new Request("http://localhost/api/user/state", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET;
  process.env.DATABASE_URL = "postgres://user:pass@example.invalid/db";
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_AUTH_MOCK;
  readUserState.mockReset();
  writeUserState.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("GET /api/user/state", () => {
  it("requires a session", async () => {
    const response = await GET(await request("GET", undefined, false));
    expect(response.status).toBe(401);
    expect(readUserState).not.toHaveBeenCalled();
  });

  it("returns the stored document uncached", async () => {
    const stored = {
      exists: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
      state: { favorites: [], preferences: { theme: "dark", displayCurrency: "native" }, recentSearches: [] },
    };
    readUserState.mockResolvedValue(stored);

    const response = await GET(await request("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(stored);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(readUserState).toHaveBeenCalledWith("alpha@gmail.com");
  });

  it("reports a missing database instead of crashing", async () => {
    delete process.env.DATABASE_URL;
    const response = await GET(await request("GET"));
    expect(response.status).toBe(503);
    expect(readUserState).not.toHaveBeenCalled();
  });

  it("maps repository failures to a generic error", async () => {
    readUserState.mockRejectedValue(new Error("relation does not exist"));
    const response = await GET(await request("GET"));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "Could not load your saved data." });
  });
});

describe("PUT /api/user/state", () => {
  it("requires a session", async () => {
    const response = await PUT(await request("PUT", { favorites: [] }, false));
    expect(response.status).toBe(401);
    expect(writeUserState).not.toHaveBeenCalled();
  });

  it("rejects malformed payloads", async () => {
    for (const body of [
      null,
      {},
      { favorites: [] },
      { favorites: "AAPL", recentSearches: [] },
      { favorites: [{ name: "no symbol" }], recentSearches: [] },
      { favorites: [{ symbol: "AAPL", quoteType: "NOT_A_TYPE" }], recentSearches: [] },
    ]) {
      const response = await PUT(await request("PUT", body));
      expect(response.status).toBe(400);
    }
    expect(writeUserState).not.toHaveBeenCalled();
  });

  it("rejects oversized watchlists", async () => {
    const favorites = Array.from({ length: MAX_FAVORITES + 1 }, (_, index) => ({
      symbol: `S${index}`,
    }));
    const response = await PUT(await request("PUT", { favorites, recentSearches: [] }));
    expect(response.status).toBe(400);
    expect(writeUserState).not.toHaveBeenCalled();
  });

  it("normalises and saves under the session email", async () => {
    writeUserState.mockResolvedValue({ updatedAt: "2026-01-02T03:04:05.000Z" });

    const response = await PUT(
      await request("PUT", {
        favorites: [{ symbol: "AAPL", addedAt: 1 }],
        preferences: { theme: "light" },
        recentSearches: [{ symbol: "MSFT" }],
      }),
    );

    expect(response.status).toBe(200);
    expect(writeUserState).toHaveBeenCalledTimes(1);
    const [email, state] = writeUserState.mock.calls[0];
    expect(email).toBe("alpha@gmail.com");
    expect(state).toMatchObject({
      favorites: [{ symbol: "AAPL", name: "AAPL", exchange: null, quoteType: "EQUITY", addedAt: 1 }],
      preferences: { theme: "light", displayCurrency: "native" },
      recentSearches: [{ symbol: "MSFT", name: "MSFT" }],
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("maps write failures to a generic error", async () => {
    writeUserState.mockRejectedValue(new Error("boom"));
    const response = await PUT(await request("PUT", { favorites: [], recentSearches: [] }));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "Could not save your data." });
  });
});
