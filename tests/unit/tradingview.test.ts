import { describe, expect, it } from "vitest";

import { mapTradingViewQuotes, mapTradingViewSearch } from "@/lib/tradingview";

describe("mapTradingViewSearch", () => {
  it("maps supported exchanges and skips ambiguous or non-equity rows", () => {
    const results = mapTradingViewSearch({
      symbols: [
        { symbol: "AAPL", description: "<em>Apple</em> Inc.", exchange: "NASDAQ", type: "stock" },
        { symbol: "TEF", description: "Telefonica SA", exchange: "BME", type: "stock" },
        { symbol: "ASML", description: "ASML Holding", exchange: "EURONEXT", type: "stock" },
        { symbol: "BTCUSD", description: "Bitcoin", exchange: "BITSTAMP", type: "crypto" },
        { symbol: "AAPL", description: "Duplicate", exchange: "NYSE", type: "stock" },
        { symbol: "SPY", description: "SPDR S&P 500 ETF", exchange: "AMEX", type: "etf" },
        { symbol: "BAD", description: "No exchange", type: "stock" },
      ],
    });

    expect(results.map((result) => result.symbol)).toEqual(["AAPL", "TEF.MC", "SPY"]);
    expect(results[0]).toMatchObject({ name: "Apple Inc.", exchangeName: "NASDAQ" });
    expect(results[1]).toMatchObject({ symbol: "TEF.MC", exchangeName: "BME" });
    expect(results[2].quoteType).toBe("ETF");
  });

  it("handles malformed payloads", () => {
    expect(mapTradingViewSearch(null)).toEqual([]);
    expect(mapTradingViewSearch({ symbols: null })).toEqual([]);
  });
});

describe("mapTradingViewQuotes", () => {
  it("maps scanner rows back to canonical symbols", () => {
    const tickerToSymbol = new Map([
      ["NASDAQ:AAPL", "AAPL"],
      ["NYSE:AAPL", "AAPL"],
      ["BME:TEF", "TEF.MC"],
    ]);
    const quotes = mapTradingViewQuotes(
      {
        data: [
          {
            s: "NASDAQ:AAPL",
            d: ["AAPL", "Apple Inc.", 342.56, -1.9, -6.65, 80568107, "USD", "NASDAQ", "stock", "delayed"],
          },
          {
            s: "NYSE:AAPL",
            d: ["AAPL", "Apple duplicate", 342.57, -1.8, -6.6, 1, "USD", "NYSE", "stock", "delayed"],
          },
          {
            s: "BME:TEF",
            d: ["TEF", "Telefonica SA", 3.36, 0.21, 0.007, 10261027, "EUR", "BME", "stock", "delayed"],
          },
          { s: "UNKNOWN:X", d: ["X", "Unknown", 1, 0, 0, 0, "USD", "X", "stock", ""] },
          { s: "NASDAQ:AAPL", d: ["bad-row"] },
        ],
      },
      tickerToSymbol,
    );

    expect(quotes.map((quote) => quote.symbol)).toEqual(["AAPL", "TEF.MC"]);
    expect(quotes[0]).toMatchObject({
      name: "Apple Inc.",
      price: 342.56,
      changePercent: -1.9,
      change: -6.65,
      previousClose: 349.21,
      currency: "USD",
      exchange: "NASDAQ",
      quoteType: "EQUITY",
      marketState: "UNKNOWN",
    });
    expect(quotes[1]).toMatchObject({ price: 3.36, currency: "EUR" });
  });

  it("ignores rows without a price", () => {
    expect(
      mapTradingViewQuotes(
        { data: [{ s: "NASDAQ:AAPL", d: ["AAPL", "Apple", null, 1, 1, 1, "USD", "NASDAQ", "stock", ""] }] },
        new Map([["NASDAQ:AAPL", "AAPL"]]),
      ),
    ).toEqual([]);
  });
});
