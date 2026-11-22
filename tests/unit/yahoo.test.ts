import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearMemoCache } from "@/lib/cache";
import {
  deriveMarketState,
  fetchQuotes,
  isValidSymbol,
  mapChartResult,
  mapNewsItems,
  mapSearchResults,
  mapSparkResult,
  normalizeSymbols,
  parseLooseJson,
  ProviderError,
} from "@/lib/yahoo";
import { chartPayload, cnbcPayload, searchPayload, sparkPayload } from "../fixtures/market";

describe("symbol validation", () => {
  it("accepts exchange suffixes and indices", () => {
    expect(isValidSymbol("AAPL")).toBe(true);
    expect(isValidSymbol("TEF.MC")).toBe(true);
    expect(isValidSymbol("^IXIC")).toBe(true);
    expect(isValidSymbol("BRK-B")).toBe(true);
    expect(isValidSymbol("")).toBe(false);
    expect(isValidSymbol("AAPL?x=1")).toBe(false);
    expect(isValidSymbol("../etc/passwd")).toBe(false);
  });

  it("normalizes, dedupes and caps symbol lists", () => {
    expect(normalizeSymbols("AAPL, MSFT,AAPL, ,bad<script>")).toEqual(["AAPL", "MSFT"]);
    expect(normalizeSymbols(Array.from({ length: 60 }, (_, i) => `S${i}`))).toHaveLength(40);
    expect(normalizeSymbols(Array.from({ length: 60 }, (_, i) => `S${i}`), 250)).toHaveLength(60);
  });
});

describe("mapSparkResult", () => {
  it("maps quote fields and filters null closes", () => {
    const result = sparkPayload.spark.result[0];
    const quote = mapSparkResult(result, 1_700_015_000);
    expect(quote).not.toBeNull();
    expect(quote).toMatchObject({
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 342.56,
      change: 6.24,
      changePercent: 1.8557,
      currency: "USD",
      exchangeName: "NasdaqGS",
      quoteType: "EQUITY",
      marketState: "OPEN",
      volume: 80_568_107,
    });
    expect(quote?.sparkline).toEqual([340, 342.56, 343.1]);
  });

  it("maps indices and tolerates missing sparkline data", () => {
    const quote = mapSparkResult(sparkPayload.spark.result[1], 1_700_015_000);
    expect(quote).toMatchObject({ symbol: "^IXIC", quoteType: "INDEX", price: 22_617.73 });
    expect(quote?.sparkline).toEqual([]);
  });

  it("keeps metadata when the provider sends no price", () => {
    const quote = mapSparkResult(sparkPayload.spark.result[2]);
    expect(quote).toMatchObject({ symbol: "BAD", price: null, change: null, quoteType: "OTHER" });
  });
});

describe("deriveMarketState", () => {
  it("uses the exchange trading windows", () => {
    const meta = sparkPayload.spark.result[0].response[0].meta;
    expect(deriveMarketState(meta, 1_700_015_000)).toBe("OPEN");
    expect(deriveMarketState(meta, 1_700_005_000)).toBe("PRE");
    expect(deriveMarketState(meta, 1_700_025_000)).toBe("POST");
    expect(deriveMarketState(meta, 1_800_000_000)).toBe("CLOSED");
  });
});

describe("mapSearchResults", () => {
  it("keeps supported instruments only, deduped", () => {
    const results = mapSearchResults(searchPayload);
    expect(results.map((result) => result.symbol)).toEqual(["TEF.MC", "^IXIC"]);
    expect(results[0]).toMatchObject({
      name: "Telefónica, S.A.",
      exchangeName: "Madrid Stock Exchange",
      sector: "Communication Services",
    });
  });
});

describe("mapNewsItems", () => {
  it("sorts newest first, dedupes links and rejects unsafe urls", () => {
    const items = mapNewsItems(searchPayload);
    expect(items.map((item) => item.title)).toEqual(["First story", "Second story"]);
    expect(items[0].publisher).toBe("Bloomberg");
  });
});

describe("mapChartResult", () => {
  it("shifts timestamps to exchange time and computes performance", () => {
    const chart = mapChartResult(chartPayload, "1M");
    expect(chart.series).toEqual([
      { time: 1_700_000_000 - 18_000, value: 350.1 },
      { time: 1_700_000_300 - 18_000, value: 351.2 },
      { time: 1_700_000_600 - 18_000, value: 352.4 },
    ]);
    expect(chart.baseline).toBe(350.1);
    expect(chart.performance).toBeCloseTo((352.4 - 350.1) / 350.1, 5);
    expect(chart.intraday).toBe(false);
    expect(chart.source).toBe("yahoo");
  });

  it("uses the previous close as baseline for the 1D range", () => {
    const chart = mapChartResult(chartPayload, "1D");
    expect(chart.baseline).toBe(349.21);
    expect(chart.performance).toBeCloseTo((352.4 - 349.21) / 349.21, 5);
    expect(chart.intraday).toBe(true);
  });

  it("throws a 404 provider error when there is no data", () => {
    expect(() => mapChartResult({ chart: { result: [] } }, "1M")).toThrow(ProviderError);
  });
});

describe("parseLooseJson", () => {
  it("parses raw and proxy-wrapped payloads", () => {
    expect(parseLooseJson('{"ok":true}')).toEqual({ ok: true });
    expect(parseLooseJson('[1,2]')).toEqual([1, 2]);
    const wrapped = 'Title: \n\nURL Source: https://example.com\n\nMarkdown Content:\n{"chart":{"result":[]}}';
    expect(parseLooseJson(wrapped)).toEqual({ chart: { result: [] } });
  });

  it("rejects payloads without JSON", () => {
    expect(() => parseLooseJson("no data here")).toThrow(ProviderError);
  });
});

describe("fetchQuotes provider fallback", () => {
  beforeEach(() => clearMemoCache());

  it("falls back to CNBC when Yahoo is throttled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("finance.yahoo.com")) {
          return new Response("Too Many Requests", { status: 429 });
        }
        if (url.includes("quote.cnbc.com")) {
          return new Response(JSON.stringify(cnbcPayload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("{}", { status: 404 });
      }),
    );

    const quotes = await fetchQuotes(["AAPL"]);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      symbol: "AAPL",
      price: 342.56,
      changePercent: -1.9,
      currency: "USD",
      quoteType: "EQUITY",
      marketState: "POST",
    });
  });
});
