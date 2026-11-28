// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/yahoo", () => ({
  fetchQuotes: vi.fn(),
  normalizeSymbols: (value: string) => value.split(",").filter(Boolean).map((symbol) => symbol.trim()),
}));

import { GET } from "@/app/api/quotes/route";
import { clearMemoCache } from "@/lib/cache";
import type { Quote } from "@/lib/types";
import { fetchQuotes } from "@/lib/yahoo";

const quote: Quote = {
  symbol: "AAPL",
  name: "Apple Inc.",
  price: 342.56,
  previousClose: 336.32,
  change: 6.24,
  changePercent: 1.86,
  currency: "USD",
  exchange: "NMS",
  exchangeName: "NasdaqGS",
  quoteType: "EQUITY",
  marketState: "OPEN",
  dayHigh: 345,
  dayLow: 335,
  fiftyTwoWeekHigh: 360,
  fiftyTwoWeekLow: 243,
  volume: 80_568_107,
  asOf: 1_700_000_000,
  timezone: "America/New_York",
  sparkline: [336, 340, 342.56],
};

function request() {
  return new Request("http://localhost/api/quotes?symbols=AAPL");
}

describe("GET /api/quotes caching", () => {
  beforeEach(() => {
    clearMemoCache();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2025-01-02T14:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stamps the payload with the fetch time and no stale flag", async () => {
    vi.mocked(fetchQuotes).mockResolvedValue([quote]);
    const body = await (await GET(request())).json();

    expect(body.stale).toBe(false);
    expect(body.fetchedAt).toBe(Date.now());
    expect(body.quotes).toEqual([quote]);
  });

  it("serves repeat requests from the cache", async () => {
    vi.mocked(fetchQuotes).mockResolvedValue([quote]);
    await GET(request());
    vi.setSystemTime(new Date("2025-01-02T14:00:20Z"));
    await GET(request());

    expect(fetchQuotes).toHaveBeenCalledTimes(1);
  });

  it("keeps the original fetch time when the copy goes stale", async () => {
    const fetchedAt = new Date("2025-01-02T14:00:00Z").getTime();
    vi.mocked(fetchQuotes).mockResolvedValue([quote]);
    await GET(request());

    // Past the fresh TTL, with every provider failing.
    vi.setSystemTime(new Date("2025-01-02T14:05:00Z"));
    vi.mocked(fetchQuotes).mockRejectedValue(new Error("yahoo 429"));
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stale).toBe(true);
    // The indicator must show the original fetch, not "just now".
    expect(body.fetchedAt).toBe(fetchedAt);
    expect(body.quotes).toEqual([quote]);
  });

  it("returns an error when nothing usable is cached", async () => {
    vi.mocked(fetchQuotes).mockRejectedValue(new Error("yahoo 429"));
    const response = await GET(request());
    expect(response.status).toBe(502);
  });
});
