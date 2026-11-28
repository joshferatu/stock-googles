// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/yahoo", () => ({
  searchInstruments: vi.fn(),
}));

vi.mock("@/lib/stockanalysis", () => ({
  searchStockAnalysis: vi.fn(),
}));

vi.mock("@/lib/tradingview", () => ({
  searchTradingView: vi.fn(),
}));

vi.mock("@/lib/nasdaq", () => ({
  searchNasdaq: vi.fn(),
}));

import { GET } from "@/app/api/search/route";
import { clearMemoCache } from "@/lib/cache";
import { searchNasdaq } from "@/lib/nasdaq";
import { searchStockAnalysis } from "@/lib/stockanalysis";
import { searchTradingView } from "@/lib/tradingview";
import type { Instrument } from "@/lib/types";
import { searchInstruments } from "@/lib/yahoo";

const apple: Instrument = {
  symbol: "AAPL",
  name: "Apple Inc.",
  exchange: "NMS",
  exchangeName: "NASDAQ",
  quoteType: "EQUITY",
  sector: "Technology",
  industry: "Consumer Electronics",
};

const tef: Instrument = {
  symbol: "TEF.MC",
  name: "Telefónica, S.A.",
  exchange: null,
  exchangeName: "Madrid",
  quoteType: "EQUITY",
  sector: null,
  industry: null,
};

function request(q = "apple") {
  return new Request(`http://localhost/api/search?q=${encodeURIComponent(q)}`);
}

describe("GET /api/search provider chain", () => {
  beforeEach(() => {
    clearMemoCache();
    vi.clearAllMocks();
    vi.mocked(searchInstruments).mockResolvedValue([]);
    vi.mocked(searchStockAnalysis).mockResolvedValue([]);
    vi.mocked(searchTradingView).mockResolvedValue([]);
    vi.mocked(searchNasdaq).mockResolvedValue([]);
  });

  it("prefers Yahoo results", async () => {
    vi.mocked(searchInstruments).mockResolvedValue([apple]);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ provider: "yahoo", results: [apple] });
    expect(searchStockAnalysis).not.toHaveBeenCalled();
  });

  it("falls back to StockAnalysis", async () => {
    vi.mocked(searchInstruments).mockRejectedValue(new Error("Yahoo throttled"));
    vi.mocked(searchStockAnalysis).mockResolvedValue([tef]);
    const response = await GET(request("telefonica"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ provider: "stockanalysis", results: [tef] });
  });

  it("falls back to TradingView, then Nasdaq", async () => {
    vi.mocked(searchInstruments).mockRejectedValue(new Error("Yahoo throttled"));
    vi.mocked(searchStockAnalysis).mockResolvedValue([]);
    vi.mocked(searchTradingView).mockResolvedValue([apple]);
    const tradingView = await GET(request());
    expect(await tradingView.json()).toMatchObject({ provider: "tradingview" });

    vi.mocked(searchTradingView).mockResolvedValue([]);
    vi.mocked(searchNasdaq).mockResolvedValue([apple]);
    // Same query, new response: drop the route cache so the chain runs again.
    clearMemoCache();
    const nasdaq = await GET(request());
    expect(await nasdaq.json()).toMatchObject({ provider: "nasdaq" });
  });

  it("returns an empty successful result when providers work but find nothing", async () => {
    const response = await GET(request("zzzzzz"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ results: [] });
  });

  it("returns an error when every provider fails", async () => {
    vi.mocked(searchInstruments).mockRejectedValue(new Error("down"));
    vi.mocked(searchStockAnalysis).mockRejectedValue(new Error("down"));
    vi.mocked(searchTradingView).mockRejectedValue(new Error("down"));
    vi.mocked(searchNasdaq).mockRejectedValue(new Error("down"));
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toHaveProperty("error");
  });
});
