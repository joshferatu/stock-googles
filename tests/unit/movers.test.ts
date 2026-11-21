import { describe, expect, it } from "vitest";

import { computeMovers } from "@/lib/movers";
import type { Quote } from "@/lib/types";

function quote(overrides: Partial<Quote> & Pick<Quote, "symbol">): Quote {
  return {
    name: overrides.symbol,
    price: 100,
    previousClose: 99,
    change: 1,
    changePercent: 1,
    currency: "USD",
    exchange: "NMS",
    exchangeName: "NasdaqGS",
    quoteType: "EQUITY",
    marketState: "OPEN",
    dayHigh: 101,
    dayLow: 99,
    fiftyTwoWeekHigh: 120,
    fiftyTwoWeekLow: 80,
    volume: 1000,
    asOf: 1_700_000_000,
    timezone: "America/New_York",
    sparkline: [],
    ...overrides,
  };
}

describe("computeMovers", () => {
  it("ranks gainers and losers by day change", () => {
    const result = computeMovers(
      [
        quote({ symbol: "A", changePercent: 1 }),
        quote({ symbol: "B", changePercent: 5 }),
        quote({ symbol: "C", changePercent: -3 }),
        quote({ symbol: "D", changePercent: -8 }),
      ],
      2,
    );
    expect(result.gainers.map((item) => item.symbol)).toEqual(["B", "A"]);
    expect(result.losers.map((item) => item.symbol)).toEqual(["D", "C"]);
  });

  it("ignores indices, flat quotes and unusable prices", () => {
    const result = computeMovers(
      [
        quote({ symbol: "IDX", changePercent: 9, quoteType: "INDEX" }),
        quote({ symbol: "FLAT", changePercent: 0 }),
        quote({ symbol: "NULLPCT", changePercent: null }),
        quote({ symbol: "NOPRICE", price: null, changePercent: 4 }),
        quote({ symbol: "OK", changePercent: 2 }),
      ],
      5,
    );
    expect(result.gainers.map((item) => item.symbol)).toEqual(["OK"]);
    expect(result.losers).toEqual([]);
  });

  it("limits results", () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      quote({ symbol: `S${index}`, changePercent: index + 1 }),
    );
    expect(computeMovers(many, 3).gainers).toHaveLength(3);
  });
});
