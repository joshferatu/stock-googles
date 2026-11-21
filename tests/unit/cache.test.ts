import { beforeEach, describe, expect, it } from "vitest";

import { clearMemoCache, memoCacheSize, memoize } from "@/lib/cache";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("memoize", () => {
  beforeEach(() => clearMemoCache());

  it("serves cached values within the TTL", async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return calls;
    };
    expect(await memoize("a", 1000, load)).toBe(1);
    expect(await memoize("a", 1000, load)).toBe(1);
    expect(calls).toBe(1);
    expect(memoCacheSize()).toBe(1);
  });

  it("coalesces concurrent loads", async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      await sleep(15);
      return "value";
    };
    const [a, b] = await Promise.all([memoize("b", 1000, load), memoize("b", 1000, load)]);
    expect(a).toBe("value");
    expect(b).toBe("value");
    expect(calls).toBe(1);
  });

  it("refreshes after expiry", async () => {
    let calls = 0;
    const load = async () => ++calls;
    expect(await memoize("c", 10, load)).toBe(1);
    await sleep(25);
    expect(await memoize("c", 10, load)).toBe(2);
  });

  it("serves a stale value when the refresh fails", async () => {
    expect(await memoize("d", 10, async () => "old")).toBe("old");
    await sleep(25);
    expect(
      await memoize("d", 10, async () => {
        throw new Error("upstream down");
      }),
    ).toBe("old");
  });

  it("propagates errors when there is nothing cached", async () => {
    await expect(
      memoize("e", 10, async () => {
        throw new Error("upstream down");
      }),
    ).rejects.toThrow("upstream down");
  });
});
