import { memoize } from "@/lib/cache";
import type { Quote, QuoteType } from "@/lib/types";
import { round } from "@/lib/utils";

/**
 * Keyless fallback quote provider.
 *
 * CNBC's public quote widget endpoint speaks the same exchange-suffixed tickers
 * Yahoo uses (TEF.MC, 7200.T, 0700.HK) and covers most global listings, which
 * makes it a cheap safety net when Yahoo throttles a deployment.
 * It has no historical bars, so charts stay Yahoo-only.
 */

const ENDPOINT = "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 7_000;
const BATCH_SIZE = 20;

const INDEX_TO_CNBC: Record<string, string> = {
  "^GSPC": ".SPX",
  "^IXIC": ".IXIC",
  "^DJI": ".DJI",
  "^GDAXI": ".GDAXI",
  "^IBEX": ".IBEX",
  "^FTSE": ".FTSE",
  "^FCHI": ".FCHI",
  "^STOXX50E": ".STOXX50E",
  "^N225": ".N225",
  "^HSI": ".HSI",
};

const CNBC_TO_INDEX: Record<string, string> = Object.fromEntries(
  Object.entries(INDEX_TO_CNBC).map(([yahoo, cnbc]) => [cnbc, yahoo]),
);

export function toCnbcSymbol(symbol: string): string {
  return INDEX_TO_CNBC[symbol] ?? symbol;
}

export function fromCnbcSymbol(symbol: string): string {
  return CNBC_TO_INDEX[symbol] ?? symbol;
}

interface CnbcRawQuote {
  symbol?: string;
  code?: number;
  name?: string;
  last?: string | number;
  change?: string | number;
  change_pct?: string | number;
  previous_day_closing?: string | number;
  currencyCode?: string;
  exchange?: string;
  type?: string;
  high?: string | number;
  low?: string | number;
  volume?: string | number;
  yrhiprice?: string | number;
  yrloprice?: string | number;
  curmktstatus?: string;
}

interface CnbcResponse {
  FormattedQuoteResult?: { FormattedQuote?: CnbcRawQuote[] };
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.+-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "+") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapQuoteType(raw: string | undefined): QuoteType {
  switch (raw?.toUpperCase()) {
    case "STOCK":
      return "EQUITY";
    case "ETF":
      return "ETF";
    case "INDEX":
      return "INDEX";
    case "FUND":
      return "MUTUALFUND";
    default:
      return "OTHER";
  }
}

function mapMarketState(raw: string | undefined): Quote["marketState"] {
  switch (raw?.toUpperCase()) {
    case "REG_MKT":
      return "OPEN";
    case "PRE_MKT":
      return "PRE";
    case "POST_MKT":
      return "POST";
    case "CLOSED":
      return "CLOSED";
    default:
      return "UNKNOWN";
  }
}

export function mapCnbcQuote(raw: CnbcRawQuote): Quote | null {
  if (!raw.symbol || (raw.code !== undefined && raw.code !== 0)) return null;
  const price = toNumber(raw.last);
  if (price == null) return null;
  const previousClose = toNumber(raw.previous_day_closing);
  const change = toNumber(raw.change);
  const changePercent = toNumber(raw.change_pct);

  return {
    symbol: fromCnbcSymbol(raw.symbol),
    name: raw.name?.trim() || fromCnbcSymbol(raw.symbol),
    price: round(price, 4),
    previousClose,
    change,
    changePercent,
    currency: raw.currencyCode ?? null,
    exchange: raw.exchange ?? null,
    exchangeName: raw.exchange ?? null,
    quoteType: mapQuoteType(raw.type),
    marketState: mapMarketState(raw.curmktstatus),
    dayHigh: toNumber(raw.high),
    dayLow: toNumber(raw.low),
    fiftyTwoWeekHigh: toNumber(raw.yrhiprice),
    fiftyTwoWeekLow: toNumber(raw.yrloprice),
    volume: toNumber(raw.volume),
    asOf: null,
    timezone: null,
    sparkline: [],
  };
}

async function fetchChunk(symbols: string[]): Promise<Quote[]> {
  const params = new URLSearchParams({
    symbols: symbols.join("|"),
    requestMethod: "itv",
    noform: "1",
    partnerId: "2",
    fund: "1",
    exthrs: "1",
    output: "json",
    events: "1",
  });
  const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Fallback provider returned ${response.status}`);
  const payload = (await response.json()) as CnbcResponse;
  const raw = payload.FormattedQuoteResult?.FormattedQuote ?? [];
  const bySymbol = new Map(
    raw
      .map((item) => mapCnbcQuote(item))
      .filter((quote): quote is Quote => quote !== null)
      .map((quote) => [quote.symbol, quote]),
  );
  return symbols.flatMap((symbol) => {
    // `symbols` are CNBC tickers here; our map is keyed by Yahoo tickers.
    const quote = bySymbol.get(fromCnbcSymbol(symbol));
    return quote ? [quote] : [];
  });
}

export async function fetchCnbcQuotes(symbols: readonly string[]): Promise<Quote[]> {
  const list = Array.from(new Set(symbols)).slice(0, 40);
  if (list.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    chunks.push(list.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      memoize(`cnbc:${chunk.join(",")}`, 30_000, () => fetchChunk(chunk.map(toCnbcSymbol))),
    ),
  );

  const bySymbol = new Map<string, Quote>();
  for (const quote of results.flat()) bySymbol.set(quote.symbol, quote);
  return list.flatMap((symbol) => {
    const quote = bySymbol.get(symbol);
    return quote ? [quote] : [];
  });
}
