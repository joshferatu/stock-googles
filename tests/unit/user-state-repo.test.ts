// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, databaseUrl, DatabaseNotConfiguredError } from "@/lib/db";

const ORIGINAL_ENV = { ...process.env };

interface Captured {
  sql: string;
  params: unknown[];
}

function mockQuery(rows: unknown[]) {
  const captured: Captured[] = [];
  const query = vi.fn(async (strings: TemplateStringsArray, ...params: unknown[]) => {
    captured.push({ sql: strings.join(" ? ").replace(/\s+/g, " ").trim(), params });
    return rows;
  });
  vi.doMock("@/lib/db", () => ({
    db: () => query,
    databaseUrl: () => "postgres://example.invalid/db",
    DatabaseNotConfiguredError,
  }));
  return captured;
}

beforeEach(() => {
  vi.resetModules();
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.doUnmock("@/lib/db");
  vi.resetModules();
});

describe("databaseUrl", () => {
  it("is null until DATABASE_URL is set", () => {
    expect(databaseUrl()).toBeNull();
    process.env.DATABASE_URL = "  ";
    expect(databaseUrl()).toBeNull();
    process.env.DATABASE_URL = "postgres://example/db";
    expect(databaseUrl()).toBe("postgres://example/db");
  });

  it("fails with a specific error, not a crash at import time", () => {
    expect(() => db()).toThrow(DatabaseNotConfiguredError);
  });
});

describe("user state repository", () => {
  it("reports a missing row without inventing state", async () => {
    mockQuery([]);
    const { readUserState: read } = await import("@/lib/user-state-repo");
    const result = await read("alpha@gmail.com");
    expect(result).toEqual({
      exists: false,
      updatedAt: null,
      state: {
        favorites: [],
        preferences: { theme: "dark", displayCurrency: "native" },
        recentSearches: [],
      },
    });
  });

  it("parses JSONB columns and normalises timestamps", async () => {
    const captured = mockQuery([
      {
        favorites: [{ symbol: "AAPL", name: "Apple Inc.", quoteType: "EQUITY", addedAt: 1 }],
        preferences: { theme: "light", displayCurrency: "USD" },
        recent_searches: [{ symbol: "MSFT", name: "Microsoft" }],
        updated_at: "2026-01-02T03:04:05.000Z",
      },
    ]);
    const { readUserState: read } = await import("@/lib/user-state-repo");
    const result = await read("alpha@gmail.com");

    expect(result.exists).toBe(true);
    expect(result.updatedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(result.state.favorites[0]).toMatchObject({ symbol: "AAPL", quoteType: "EQUITY" });
    expect(result.state.preferences).toEqual({ theme: "light", displayCurrency: "USD" });
    expect(result.state.recentSearches).toHaveLength(1);
    expect(captured[0].params).toEqual(["alpha@gmail.com"]);
  });

  it("upserts JSON strings and returns the new timestamp", async () => {
    const captured = mockQuery([{ updated_at: "2026-02-03T04:05:06.000Z" }]);
    const { writeUserState: write } = await import("@/lib/user-state-repo");
    const saved = await write("alpha@gmail.com", {
      favorites: [
        { symbol: "AAPL", name: "Apple Inc.", exchange: null, quoteType: "EQUITY", addedAt: 1 },
      ],
      preferences: { theme: "dark", displayCurrency: "EUR" },
      recentSearches: [],
    });

    expect(saved.updatedAt).toBe("2026-02-03T04:05:06.000Z");
    expect(captured[0].sql).toContain("on conflict (user_id) do update");
    const params = captured[0].params;
    expect(params[0]).toBe("alpha@gmail.com");
    expect(JSON.parse(String(params[1]))).toHaveLength(1);
    expect(JSON.parse(String(params[2]))).toEqual({ theme: "dark", displayCurrency: "EUR" });
    expect(JSON.parse(String(params[3]))).toEqual([]);
  });
});
