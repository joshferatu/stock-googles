// @vitest-environment node
import { Redis } from "@upstash/redis";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readShared, resetSharedCache, sharedCacheEnabled, writeShared } from "@/lib/redis";

/** The real client against an in-memory stand-in for the Upstash REST API. */
function fakeUpstash() {
  const store = new Map<string, string>();
  const commands: string[][] = [];
  const requester = {
    // A custom requester receives the whole command as an array in `body`.
    request: async ({ body }: { body?: unknown }) => {
      const command = Array.isArray(body) ? body.map((part) => String(part)) : [];
      commands.push(command);
      const [name, key, value] = command;
      if (name === "get") return { result: store.get(key) ?? null };
      if (name === "set") {
        store.set(key, value);
        return { result: "OK" };
      }
      return { result: null };
    },
  };
  return { store, commands, client: new Redis(requester as never) };
}

describe("shared Redis client", () => {
  afterEach(() => {
    resetSharedCache();
    vi.unstubAllEnvs();
  });

  it("round-trips a raw JSON envelope without re-serialising it", async () => {
    const fake = fakeUpstash();
    resetSharedCache(fake.client);
    const raw = JSON.stringify({ value: { quotes: [{ symbol: "AAPL" }] }, storedAt: 1_700_000_000_000 });

    await writeShared("sg:v1:quotes:AAPL", raw, 60_000);

    // The TTL must travel as PX so Redis expires keys on its own.
    expect(fake.commands).toEqual([["set", "sg:v1:quotes:AAPL", raw, "px", "60000"]]);

    // Must come back as the same string: `cache.ts` owns the JSON parsing.
    expect(await readShared("sg:v1:quotes:AAPL")).toBe(raw);
    expect(fake.commands[1]).toEqual(["get", "sg:v1:quotes:AAPL"]);
  });

  it("returns null for a missing key", async () => {
    resetSharedCache(fakeUpstash().client);
    expect(await readShared("sg:v1:absent")).toBeNull();
  });

  it("degrades quietly and cools down when Upstash fails", async () => {
    const failing = { request: async () => Promise.reject(new Error("upstash 503")) };
    resetSharedCache(new Redis(failing as never));

    expect(await readShared("sg:v1:quotes:AAPL")).toBeNull();
    await expect(writeShared("sg:v1:quotes:AAPL", "{}", 1000)).resolves.toBeUndefined();
    // After the first failure the client stops trying, so requests stay fast.
    expect(sharedCacheEnabled()).toBe(false);
  });

  it("is disabled without credentials", () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    resetSharedCache();
    expect(sharedCacheEnabled()).toBe(false);
  });
});
