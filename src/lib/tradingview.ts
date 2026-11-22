import { memoize } from "@/lib/cache";
import { ProviderError } from "@/lib/errors";
import type { Instrument, Quote } from "@/lib/types";
import { deriveTradingViewTickers, stripTags, tvSearchRowToSymbol } from "@/lib/symbols";

/**
 * Keyless fallbacks backed by TradingView's public scanner and symbol search.
 * The scanner gives global quotes (no historical bars); symbol search gives
 * global instruments. Both are unofficial endpoints.
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 9_000;

const SCAN_URL = "https://scanner.tradingview.com/global/scan";
const SEARCH_URL = "https://symbol-search.tradingview.com/symbol_search/v3/";
const SCAN_COLUMNS = [
  "name",
  "description",
  "close",
  "change",
  "change_abs",
  "volume",
  "currency",
  "exchange",
  "type",
  "update_mode",
];

interface TvSearchRow {
  symbol?: string;
  description?: string;
  exchange?: string;
  type?: string;
}

interface TvScanResponse {
  data?: Array<{ s?: string; d?: Array<string | number | null> }>;
}

function mapType(raw: string | undefined): Quote["quoteType"] {
  switch (raw?.toLowerCase()) {
    case "stock":
    case "dr":
      return "EQUITY";
    case "etf":
    case "fund":
      return "ETF";
    case "index":
      return "INDEX";
    default:
      return "OTHER";
  }
}

export function mapTradingViewSearch(payload: unknown): Instrument[] {
  const rows = (payload as { symbols?: TvSearchRow[] } | null)?.symbols;
  if (!Array.isArray(rows)) return [];
  const out: Instrument[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row?.symbol || !row.exchange) continue;
    const type = mapType(row.type);
    if (type !== "EQUITY" && type !== "ETF") continue;
    const symbol = tvSearchRowToSymbol(row.exchange, row.symbol);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({
      symbol,
      name: stripTags(row.description ?? row.symbol),
      exchange: row.exchange,
      exchangeName: row.exchange,
      quoteType: type,
      sector: null,
      industry: null,
    });
    if (out.length >= 15) break;
  }
  return out;
}

export function mapTradingViewQuotes(
  payload: TvScanResponse,
  tickerToSymbol: ReadonlyMap<string, string>,
): Quote[] {
  const rows = payload.data ?? [];
  const bySymbol = new Map<string, Quote>();
  for (const row of rows) {
    const ticker = row.s;
    const data = row.d;
    if (!ticker || !Array.isArray(data) || data.length < 9) continue;
    const symbol = tickerToSymbol.get(ticker);
    if (!symbol || bySymbol.has(symbol)) continue;
    const price = typeof data[2] === "number" && Number.isFinite(data[2]) ? data[2] : null;
    if (price == null) continue;
    const changePercent =
      typeof data[3] === "number" && Number.isFinite(data[3]) ? data[3] : null;
    const change = typeof data[4] === "number" && Number.isFinite(data[4]) ? data[4] : null;
    bySymbol.set(symbol, {
      symbol,
      name: String(data[1] || data[0] || symbol),
      price,
      previousClose: change != null ? price - change : null,
      change,
      changePercent,
      currency: typeof data[6] === "string" ? data[6] : null,
      exchange: typeof data[7] === "string" ? data[7] : null,
      exchangeName: typeof data[7] === "string" ? data[7] : null,
      quoteType: mapType(typeof data[8] === "string" ? data[8] : undefined),
      marketState: "UNKNOWN",
      dayHigh: null,
      dayLow: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      volume: typeof data[5] === "number" && Number.isFinite(data[5]) ? data[5] : null,
      asOf: null,
      timezone: null,
      sparkline: [],
    });
  }
  return Array.from(bySymbol.values());
}

export async function searchTradingView(query: string): Promise<Instrument[]> {
  const q = query.trim();
  if (!q) return [];
  return memoize(`tv:search:${q.toLowerCase()}`, 2 * 60_000, async () => {
    const url =
      `${SEARCH_URL}?text=${encodeURIComponent(q)}&hl=1&exchange=&lang=en&search_type=stocks&domain=production`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        Origin: "https://www.tradingview.com",
        Referer: "https://www.tradingview.com/",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new ProviderError(`TradingView search returned ${response.status}`, 502);
    }
    return mapTradingViewSearch((await response.json()) as unknown);
  });
}

export async function fetchTradingViewQuotes(symbols: readonly string[]): Promise<Quote[]> {
  const tickerToSymbol = new Map<string, string>();
  for (const symbol of symbols) {
    for (const ticker of deriveTradingViewTickers(symbol)) {
      if (!tickerToSymbol.has(ticker)) tickerToSymbol.set(ticker, symbol);
    }
  }
  const tickers = Array.from(tickerToSymbol.keys()).slice(0, 40);
  if (tickers.length === 0) return [];

  return memoize(`tv:quotes:${tickers.join(",")}`, 30_000, async () => {
    const response = await fetch(SCAN_URL, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://www.tradingview.com",
        Referer: "https://www.tradingview.com/",
      },
      body: JSON.stringify({
        symbols: { tickers, query: { types: [] } },
        columns: SCAN_COLUMNS,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new ProviderError(`TradingView quotes returned ${response.status}`, 502);
    }
    return mapTradingViewQuotes((await response.json()) as TvScanResponse, tickerToSymbol);
  });
}
