import { describe, expect, it } from "vitest";

import {
  deriveStockAnalysisId,
  deriveTradingViewTickers,
  saIdToSymbol,
  stripTags,
  tvSearchRowToSymbol,
} from "@/lib/symbols";

describe("saIdToSymbol", () => {
  it("maps US ids to plain symbols", () => {
    expect(saIdToSymbol("AAPL")).toEqual({ symbol: "AAPL", exchangeName: null });
  });

  it("maps international prefixes to Yahoo suffixes", () => {
    expect(saIdToSymbol("bme/TEF")).toEqual({ symbol: "TEF.MC", exchangeName: "Madrid" });
    expect(saIdToSymbol("tsx/APLE")).toEqual({ symbol: "APLE.TO", exchangeName: "Toronto" });
    expect(saIdToSymbol("tyo/7203")).toEqual({ symbol: "7203.T", exchangeName: "Tokyo" });
    expect(saIdToSymbol("bvmf/VIVT3")).toEqual({ symbol: "VIVT3.SA", exchangeName: "B3 Brazil" });
    expect(saIdToSymbol("otc/AAPI")).toEqual({ symbol: "AAPI", exchangeName: "OTC Markets" });
  });

  it("rejects unknown exchanges and empty ids", () => {
    expect(saIdToSymbol("unknown/X")).toBeNull();
    expect(saIdToSymbol("")).toBeNull();
    expect(saIdToSymbol("bme/")).toBeNull();
  });
});

describe("deriveStockAnalysisId", () => {
  it("supports US symbols only", () => {
    expect(deriveStockAnalysisId("AAPL")).toBe("AAPL");
    expect(deriveStockAnalysisId("BRK-B")).toBe("BRK-B");
    expect(deriveStockAnalysisId("TEF.MC")).toBeNull();
    expect(deriveStockAnalysisId("^IXIC")).toBeNull();
    expect(deriveStockAnalysisId("")).toBeNull();
  });
});

describe("TradingView symbol mapping", () => {
  it("derives exchange-qualified tickers", () => {
    expect(deriveTradingViewTickers("AAPL")).toEqual(["NASDAQ:AAPL", "NYSE:AAPL"]);
    expect(deriveTradingViewTickers("TEF.MC")).toEqual(["BME:TEF"]);
    expect(deriveTradingViewTickers("^IXIC")).toEqual([]);
    expect(deriveTradingViewTickers("XYZ.UNKNOWN")).toEqual([]);
  });

  it("maps search exchanges back to canonical symbols", () => {
    expect(tvSearchRowToSymbol("NASDAQ", "AAPL")).toBe("AAPL");
    expect(tvSearchRowToSymbol("NASDAQ", "BRK.B")).toBe("BRK-B");
    expect(tvSearchRowToSymbol("BME", "TEF")).toBe("TEF.MC");
    expect(tvSearchRowToSymbol("TSE", "7203")).toBe("7203.T");
    expect(tvSearchRowToSymbol("EURONEXT", "ASML")).toBeNull();
    expect(tvSearchRowToSymbol("CRYPTO", "BTCUSD")).toBeNull();
    expect(tvSearchRowToSymbol("NASDAQ", "")).toBeNull();
  });
});

describe("stripTags", () => {
  it("removes HTML from TradingView descriptions", () => {
    expect(stripTags("<em>Telefonica</em> SA &amp; Co.")).toBe("Telefonica SA & Co.");
  });
});
