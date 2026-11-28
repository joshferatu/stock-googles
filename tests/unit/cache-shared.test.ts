import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();
  return {
    store,
    ttls,
    readShared: vi.fn(async (key: string) => store.get(key) ?? null),
    writeShared: vi.fn(async (key: string, raw: string, ttlMs: number) => {
      store.set(key, raw);
      ttls.set(key, ttlMs);
    }),
  };
});

vi.mock("@/lib/redis", () => ({
  readShared: shared.readShared,
  writeShared: shared.writeShared,
  sharedCacheEnabled: () => true,
  resetSharedCache: () => undefined,
}));

import { cached, clearMemoCache, STALE_WINDOW_MS } from "@/lib/cache";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Simulates a fresh function instance: L1 empty, Redis still populated. */
function coldInstance() {
  clearMemoCache();
}

describe("cached (shared layer)", () => {
  beforeEach(() => {
    clearMemoCache();
    shared.store.clear();
    shared.ttls.clear();
    shared.readShared.mockClear();
    shared.writeShared.mockClear();
  });

  it("writes through to Redis with the fresh TTL plus the stale window", async () => {
    const load = vi.fn(async () => "quotes");
    const result = await cached("quotes:AAPL", { ttlMs: 30_000 }, load);

    expect(result.value).toBe("quotes");
    expect(result.meta.stale).toBe(false);
    expect(Math.abs(result.meta.storedAt - Date.now())).toBeLessThan(1000);

    expect(shared.writeShared).toHaveBeenCalledTimes(1);
    const [key, raw] = shared.writeShared.mock.calls[0];
    expect(key).toBe("sg:v1:quotes:AAPL");
    expect(JSON.parse(raw).value).toBe("quotes");
    expect(shared.ttls.get("sg:v1:quotes:AAPL")).toBe(30_000 + STALE_WINDOW_MS);
  });

  it("hydrates a cold instance from Redis instead of calling the provider", async () => {
    const load = vi.fn(async () => "quotes");
    await cached("quotes:AAPL", { ttlMs: 30_000 }, load);

    coldInstance();
    const result = await cached("quotes:AAPL", { ttlMs: 30_000 }, load);

    expect(result.value).toBe("quotes");
    expect(result.meta.stale).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves the shared copy as stale when the provider fails", async () => {
    await cached("quotes:AAPL", { ttlMs: 10 }, async () => "yesterday");
    await sleep(25);
    coldInstance();

    const result = await cached("quotes:AAPL", { ttlMs: 10 }, async () => {
      throw new Error("yahoo 429");
    });

    expect(result.value).toBe("yesterday");
    expect(result.meta.stale).toBe(true);
  });

  it("gives up once the stale window has passed", async () => {
    await cached("chart:AAPL:1D", { ttlMs: 10, staleMs: 20 }, async () => "too old");
    await sleep(60);
    coldInstance();

    await expect(
      cached("chart:AAPL:1D", { ttlMs: 10, staleMs: 20 }, async () => {
        throw new Error("upstream down");
      }),
    ).rejects.toThrow("upstream down");
  });

  it("does not touch Redis for instance-only keys", async () => {
    await cached("provider:quotes", { ttlMs: 1000, shared: false }, async () => "value");
    expect(shared.readShared).not.toHaveBeenCalled();
    expect(shared.writeShared).not.toHaveBeenCalled();
  });

  it("stays up when Redis throws", async () => {
    shared.readShared.mockRejectedValueOnce(new Error("upstash 500"));
    shared.writeShared.mockRejectedValueOnce(new Error("upstash 500"));

    const result = await cached("quotes:MSFT", { ttlMs: 30_000 }, async () => "live");
    expect(result.value).toBe("live");
    expect(result.meta.stale).toBe(false);
  });

  it("ignores an unreadable shared entry", async () => {
    shared.store.set("sg:v1:quotes:MSFT", "not json");
    const result = await cached("quotes:MSFT", { ttlMs: 30_000 }, async () => "live");
    expect(result.value).toBe("live");
  });
});
