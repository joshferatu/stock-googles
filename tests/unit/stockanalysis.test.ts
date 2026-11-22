import { describe, expect, it } from "vitest";

import {
  mapStockAnalysisHistory,
  mapStockAnalysisSearch,
} from "@/lib/stockanalysis";

describe("mapStockAnalysisSearch", () => {
  it("maps and dedupes supported rows", () => {
    const results = mapStockAnalysisSearch({
      data: [
        { id: "AAPL", s: "AAPL", t: "s", n: "Apple Inc." },
        { id: "BME-TEF", s: "bme/TEF", t: "sy", n: "Telefónica, S.A.", st: "s" },
        { id: "TSX-APLE", s: "tsx/APLE", t: "sy", n: "Apple Hospitality REIT", st: "e" },
        { id: "BAD", s: "crypto/BTC", t: "s", n: "Unknown exchange" },
        { id: "AAPL-DUP", s: "AAPL", t: "s", n: "Duplicate" },
      ],
    });

    expect(results.map((result) => result.symbol)).toEqual(["AAPL", "TEF.MC", "APLE.TO"]);
    expect(results[1]).toMatchObject({
      name: "Telefónica, S.A.",
      exchangeName: "Madrid",
      quoteType: "EQUITY",
    });
    expect(results[2].quoteType).toBe("ETF");
  });

  it("handles malformed payloads", () => {
    expect(mapStockAnalysisSearch(null)).toEqual([]);
    expect(mapStockAnalysisSearch({ data: null })).toEqual([]);
    expect(mapStockAnalysisSearch({ data: [{ s: "AAPL" }] })).toEqual([]);
  });
});

describe("mapStockAnalysisHistory", () => {
  const rows = Array.from({ length: 30 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return { t: `2026-01-${day}`, c: 100 + index };
  }).reverse(); // provider returns newest first

  it("slices the 1D range to the last two daily points", () => {
    const chart = mapStockAnalysisHistory({ data: rows }, "AAPL", "1D");
    expect(chart.series).toHaveLength(2);
    expect(chart.series[1].value).toBe(129);
    expect(chart.baseline).toBe(128);
    expect(chart.performance).toBeCloseTo(1 / 128, 6);
    expect(chart.source).toBe("stockanalysis");
    expect(chart.intraday).toBe(false);
    expect(chart.note).toContain("Daily closes");
  });

  it("slices 1M to 22 daily points", () => {
    const chart = mapStockAnalysisHistory({ data: rows }, "AAPL", "1M");
    expect(chart.series).toHaveLength(22);
    expect(chart.series[0].value).toBe(108);
    expect(chart.performance).toBeCloseTo((129 - 108) / 108, 6);
  });

  it("keeps all points for long ranges and accepts nested data", () => {
    const chart = mapStockAnalysisHistory({ data: { data: rows } }, "AAPL", "1Y");
    expect(chart.series).toHaveLength(30);
    expect(chart.series[0].time).toBeLessThan(chart.series[29].time);
  });

  it("rejects empty or unusable payloads", () => {
    expect(() => mapStockAnalysisHistory({ data: [] }, "AAPL", "1M")).toThrow();
    expect(() =>
      mapStockAnalysisHistory({ data: [{ t: "2026-01-01", c: 100 }] }, "AAPL", "1M"),
    ).toThrow();
    expect(() =>
      mapStockAnalysisHistory({ data: [{ t: "bad-date", c: 100 }, { t: "2026-01-02", c: 101 }] }, "AAPL", "1M"),
    ).toThrow();
  });
});
