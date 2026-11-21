import { describe, expect, it } from "vitest";

import { fromCnbcSymbol, mapCnbcQuote, toCnbcSymbol, toNumber } from "@/lib/cnbc";
import { cnbcPayload } from "../fixtures/market";

describe("CNBC symbol mapping", () => {
  it("maps yahoo indices to CNBC index tickers", () => {
    expect(toCnbcSymbol("^IXIC")).toBe(".IXIC");
    expect(toCnbcSymbol("^GSPC")).toBe(".SPX");
    expect(toCnbcSymbol("TEF.MC")).toBe("TEF.MC");
    expect(fromCnbcSymbol(".SPX")).toBe("^GSPC");
    expect(fromCnbcSymbol("AAPL")).toBe("AAPL");
  });
});

describe("toNumber", () => {
  it("parses padded finance strings", () => {
    expect(toNumber("$1,234.56")).toBe(1234.56);
    expect(toNumber("-1.90%")).toBe(-1.9);
    expect(toNumber("+0.21%")).toBe(0.21);
    expect(toNumber("N/A")).toBeNull();
    expect(toNumber("")).toBeNull();
    expect(toNumber(42)).toBe(42);
    expect(toNumber(null)).toBeNull();
  });
});

describe("mapCnbcQuote", () => {
  it("maps a stock quote", () => {
    const quote = mapCnbcQuote(cnbcPayload.FormattedQuoteResult.FormattedQuote[0]);
    expect(quote).toMatchObject({
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 342.56,
      previousClose: 349.21,
      change: -6.65,
      changePercent: -1.9,
      currency: "USD",
      quoteType: "EQUITY",
      marketState: "POST",
      fiftyTwoWeekHigh: 360.83,
      fiftyTwoWeekLow: 243.42,
      volume: 69_422_613,
    });
  });

  it("maps an index quote back to its Yahoo symbol", () => {
    const quote = mapCnbcQuote(cnbcPayload.FormattedQuoteResult.FormattedQuote[1]);
    expect(quote).toMatchObject({ symbol: "^IXIC", quoteType: "INDEX", marketState: "OPEN" });
  });

  it("ignores unavailable instruments", () => {
    expect(mapCnbcQuote(cnbcPayload.FormattedQuoteResult.FormattedQuote[2])).toBeNull();
  });
});
