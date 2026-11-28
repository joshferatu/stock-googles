// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/yahoo", () => ({
  fetchChart: vi.fn(),
  isValidSymbol: vi.fn(() => true),
}));

vi.mock("@/lib/stockanalysis", () => ({
  fetchStockAnalysisChart: vi.fn(),
}));

import { GET } from "@/app/api/chart/route";
import { clearMemoCache } from "@/lib/cache";
import { fetchStockAnalysisChart } from "@/lib/stockanalysis";
import type { ChartPayload } from "@/lib/types";
import { fetchChart } from "@/lib/yahoo";

const yahooChart: ChartPayload = {
  symbol: "AAPL",
  currency: "USD",
  exchangeName: "NasdaqGS",
  timezone: "America/New_York",
  offset: -18_000,
  range: "1M",
  interval: "1d",
  intraday: false,
  baseline: 100,
  performance: 0.1,
  source: "yahoo",
  series: [
    { time: 1, value: 100 },
    { time: 2, value: 110 },
  ],
};

const fallbackChart: ChartPayload = {
  ...yahooChart,
  source: "stockanalysis",
  note: "Daily closes",
};

function request() {
  return new Request("http://localhost/api/chart?symbol=AAPL&range=1M");
}

describe("GET /api/chart", () => {
  beforeEach(() => {
    clearMemoCache();
    vi.clearAllMocks();
  });

  it("returns the Yahoo chart when it succeeds", async () => {
    vi.mocked(fetchChart).mockResolvedValue(yahooChart);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: "yahoo", symbol: "AAPL" });
    expect(fetchStockAnalysisChart).not.toHaveBeenCalled();
  });

  it("falls back to StockAnalysis when Yahoo fails", async () => {
    vi.mocked(fetchChart).mockRejectedValue(new Error("Yahoo throttled"));
    vi.mocked(fetchStockAnalysisChart).mockResolvedValue(fallbackChart);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      source: "stockanalysis",
      note: "Daily closes",
    });
  });

  it("serves the last cached series flagged stale when both providers fail", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2025-01-02T14:00:00Z"));
    try {
      vi.mocked(fetchChart).mockResolvedValue(yahooChart);
      const first = await GET(request());
      expect(await first.json()).toMatchObject({ stale: false, source: "yahoo" });

      vi.setSystemTime(new Date("2025-01-02T14:10:00Z"));
      vi.mocked(fetchChart).mockRejectedValue(new Error("Yahoo throttled"));
      vi.mocked(fetchStockAnalysisChart).mockRejectedValue(new Error("No fallback"));

      const second = await GET(request());
      expect(second.status).toBe(200);
      expect(await second.json()).toMatchObject({ stale: true, source: "yahoo", series: yahooChart.series });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns the original provider status when both fail", async () => {
    vi.mocked(fetchChart).mockRejectedValue(
      Object.assign(new Error("Symbol not found"), { status: 404 }),
    );
    vi.mocked(fetchStockAnalysisChart).mockRejectedValue(new Error("No fallback"));
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "Symbol not found" });
  });
});
