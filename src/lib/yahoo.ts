import { memoize } from "@/lib/cache";
import { fetchCnbcQuotes } from "@/lib/cnbc";
import { RANGES, type RangeId } from "@/lib/ranges";
import type { ChartPayload, Instrument, NewsItem, Quote, QuoteType } from "@/lib/types";
import { YAHOO_SPARK_BATCH_SIZE } from "@/lib/universe";
import { round } from "@/lib/utils";

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 6_000;
/** After a 429, skip Yahoo for a bit and let callers fall back quickly. */
let yahooCooldownUntil = 0;
const COOLDOWN_MS = 90_000;

export class ProviderError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

const SYMBOL_PATTERN = /^[A-Za-z0-9^][A-Za-z0-9.^=_-]{0,23}$/;

export function isValidSymbol(symbol: string): boolean {
  return SYMBOL_PATTERN.test(symbol);
}

export function normalizeSymbols(input: readonly string[] | string): string[] {
  const list = typeof input === "string" ? input.split(",") : input;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const symbol = raw.trim();
    if (!symbol || !isValidSymbol(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
    if (out.length >= 40) break;
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with a short timeout, host rotation and retries.
 * Yahoo rate-limits bursts aggressively, so callers must cache and batch.
 */
async function fetchJson(path: string): Promise<unknown> {
  let lastError: unknown = new ProviderError("Market data provider unavailable");
  if (Date.now() < yahooCooldownUntil) {
    throw new ProviderError("Market data provider is rate limiting requests", 429);
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const host = HOSTS[attempt % HOSTS.length];
    try {
      const response = await fetch(host + path, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (response.status === 429) {
        yahooCooldownUntil = Date.now() + COOLDOWN_MS;
        lastError = new ProviderError("Market data provider is rate limiting requests", 429);
        break;
      }
      if (!response.ok) {
        lastError = new ProviderError(`Market data provider returned ${response.status}`, 502);
        continue;
      }
      const body = await response.text();
      try {
        return JSON.parse(body) as unknown;
      } catch {
        lastError = new ProviderError("Market data provider returned an unexpected response", 502);
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await sleep(250);
  }
  throw lastError instanceof Error
    ? new ProviderError(`Market data provider unavailable: ${lastError.message}`, 502)
    : new ProviderError("Market data provider unavailable");
}

/** Simple worker pool: keeps upstream bursts small. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/* ------------------------------------------------------------------ */
/* Raw shapes (only the fields we consume)                             */
/* ------------------------------------------------------------------ */

interface TradingWindow {
  start?: number;
  end?: number;
}

interface SparkMeta {
  currency?: string;
  symbol?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  instrumentType?: string;
  regularMarketTime?: number;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  fulldayPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  longName?: string;
  shortName?: string;
  exchangeTimezoneName?: string;
  currentTradingPeriod?: { pre?: TradingWindow; regular?: TradingWindow; post?: TradingWindow };
  dataGranularity?: string;
}

interface SparkResult {
  symbol?: string;
  response?: Array<{
    meta?: SparkMeta;
    timestamp?: number[];
    indicators?: { quote?: Array<{ close?: Array<number | null> }> };
  }>;
}

interface SparkResponse {
  spark?: { result?: SparkResult[]; error?: { code?: string; description?: string } };
}

interface SearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchDisp?: string;
  exchange?: string;
  sectorDisp?: string;
  sector?: string;
  industryDisp?: string;
  industry?: string;
  isYahooFinance?: boolean;
}

interface SearchNews {
  uuid?: string;
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number;
  relatedTickers?: string[];
}

interface SearchResponse {
  quotes?: SearchQuote[];
  news?: SearchNews[];
  finance?: { error?: { description?: string } };
}

interface ChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        symbol?: string;
        exchangeName?: string;
        exchangeTimezoneName?: string;
        gmtoffset?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        dataGranularity?: string;
      };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
    error?: { code?: string; description?: string };
  };
}

/* ------------------------------------------------------------------ */
/* Mappers (exported for tests)                                       */
/* ------------------------------------------------------------------ */

const ALLOWED_TYPES = new Set(["EQUITY", "ETF", "INDEX", "MUTUALFUND"]);

function mapQuoteType(raw: string | undefined): QuoteType {
  switch (raw) {
    case "EQUITY":
      return "EQUITY";
    case "ETF":
      return "ETF";
    case "INDEX":
      return "INDEX";
    case "MUTUALFUND":
      return "MUTUALFUND";
    default:
      return "OTHER";
  }
}

export function deriveMarketState(meta: SparkMeta, nowSeconds: number): Quote["marketState"] {
  const { pre, regular, post } = meta.currentTradingPeriod ?? {};
  const inside = (window?: TradingWindow) =>
    Boolean(window?.start && window?.end && nowSeconds >= window.start && nowSeconds <= window.end);
  if (inside(regular)) return "OPEN";
  if (inside(pre)) return "PRE";
  if (inside(post)) return "POST";
  // Holidays and stale sessions: fall back to how recent the last trade is.
  if (meta.regularMarketTime && nowSeconds - meta.regularMarketTime < 180) return "OPEN";
  return "CLOSED";
}

export function mapSparkResult(result: SparkResult, nowSeconds = Math.floor(Date.now() / 1000)): Quote | null {
  const item = result.response?.[0];
  const meta = item?.meta;
  if (!item || !meta?.symbol) return null;

  const closes = (item.indicators?.quote?.[0]?.close ?? []).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  const price =
    meta.regularMarketPrice ??
    meta.fulldayPrice ??
    (closes.length > 0 ? closes[closes.length - 1] : null);
  const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change =
    typeof meta.regularMarketChange === "number"
      ? meta.regularMarketChange
      : price != null && previousClose != null
        ? price - previousClose
        : null;
  const changePercent =
    typeof meta.regularMarketChangePercent === "number"
      ? meta.regularMarketChangePercent
      : price != null && previousClose
        ? ((price - previousClose) / previousClose) * 100
        : null;

  const sparkline = closes.length > 60 ? closes.slice(-60) : closes;

  return {
    symbol: meta.symbol,
    name: meta.longName ?? meta.shortName ?? meta.symbol,
    price,
    previousClose,
    change,
    changePercent,
    currency: meta.currency ?? null,
    exchange: meta.exchangeName ?? null,
    exchangeName: meta.fullExchangeName ?? meta.exchangeName ?? null,
    quoteType: mapQuoteType(meta.instrumentType),
    marketState: deriveMarketState(meta, nowSeconds),
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
    volume: meta.regularMarketVolume ?? null,
    asOf: meta.regularMarketTime ?? null,
    timezone: meta.exchangeTimezoneName ?? null,
    sparkline: sparkline.map((value) => round(value, 4)),
  };
}

export function mapSearchResults(payload: SearchResponse): Instrument[] {
  const seen = new Set<string>();
  const results: Instrument[] = [];
  for (const quote of payload.quotes ?? []) {
    const symbol = quote.symbol?.trim();
    if (!symbol || seen.has(symbol) || !ALLOWED_TYPES.has(quote.quoteType ?? "")) continue;
    if (quote.isYahooFinance === false) continue;
    seen.add(symbol);
    results.push({
      symbol,
      name: quote.longname ?? quote.shortname ?? symbol,
      exchange: quote.exchange ?? null,
      exchangeName: quote.exchDisp ?? null,
      quoteType: mapQuoteType(quote.quoteType),
      sector: quote.sectorDisp ?? quote.sector ?? null,
      industry: quote.industryDisp ?? quote.industry ?? null,
    });
  }
  return results;
}

export function mapNewsItems(payload: SearchResponse): NewsItem[] {
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const news of payload.news ?? []) {
    const link = news.link?.trim();
    const title = news.title?.trim();
    if (!link || !title || !link.startsWith("http") || seen.has(link)) continue;
    seen.add(link);
    items.push({
      id: news.uuid ?? link,
      title,
      publisher: news.publisher?.trim() || "Yahoo Finance",
      link,
      publishedAt: news.providerPublishTime ?? 0,
      tickers: news.relatedTickers ?? [],
    });
  }
  return items.sort((a, b) => b.publishedAt - a.publishedAt);
}

export function mapChartResult(
  payload: ChartResponse,
  rangeId: RangeId,
): ChartPayload {
  const result = payload.chart?.result?.[0];
  if (!result?.meta) {
    throw new ProviderError(
      payload.chart?.error?.description ?? "No chart data available for this symbol",
      404,
    );
  }
  const meta = result.meta;
  const offset = meta.gmtoffset ?? 0;
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const series: ChartPayload["series"] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) continue;
    series.push({ time: timestamps[i] + offset, value: round(close, 4) });
  }
  if (series.length === 0) {
    throw new ProviderError("No chart data available for this symbol", 404);
  }

  const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const baseline =
    rangeId === "1D" ? (previousClose ?? series[0].value) : series[0].value;
  const last = series[series.length - 1].value;
  const performance = baseline > 0 ? (last - baseline) / baseline : null;

  return {
    symbol: meta.symbol ?? "",
    currency: meta.currency ?? null,
    exchangeName: meta.exchangeName ?? null,
    timezone: meta.exchangeTimezoneName ?? null,
    offset,
    range: rangeId,
    interval: RANGES[rangeId].interval,
    intraday: RANGES[rangeId].intraday,
    baseline,
    performance,
    series,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function searchInstruments(query: string): Promise<Instrument[]> {
  const q = query.trim();
  if (!q) return [];
  return memoize(`search:${q.toLowerCase()}`, 60_000, async () => {
    const payload = (await fetchJson(
      `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&listsCount=0&enableFuzzyQuery=false&enableEnhancedTrivialQuery=true`,
    )) as SearchResponse;
    return mapSearchResults(payload);
  });
}

export async function fetchQuotes(symbols: readonly string[]): Promise<Quote[]> {
  const list = normalizeSymbols(symbols);
  if (list.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < list.length; i += YAHOO_SPARK_BATCH_SIZE) {
    chunks.push(list.slice(i, i + YAHOO_SPARK_BATCH_SIZE));
  }

  const quotes = await mapLimit(chunks, 2, fetchQuoteChunk);

  const bySymbol = new Map<string, Quote>();
  for (const quote of quotes.flat()) bySymbol.set(quote.symbol, quote);
  return list.flatMap((symbol) => {
    const quote = bySymbol.get(symbol);
    return quote ? [quote] : [];
  });
}

async function fetchYahooQuoteChunk(chunk: string[]): Promise<Quote[]> {
  return memoize(`quotes:${chunk.join(",")}`, 30_000, async () => {
    const path = `/v7/finance/spark?symbols=${encodeURIComponent(chunk.join(","))}&range=1d&interval=5m`;
    const payload = (await fetchJson(path)) as SparkResponse;
    if (payload.spark?.error?.description) {
      throw new ProviderError(payload.spark.error.description);
    }
    const now = Math.floor(Date.now() / 1000);
    return (payload.spark?.result ?? [])
      .map((result) => mapSparkResult(result, now))
      .filter((quote): quote is Quote => quote !== null);
  });
}

/** Yahoo first; if it throttles, fall back to CNBC for the same batch. */
async function fetchQuoteChunk(chunk: string[]): Promise<Quote[]> {
  try {
    return await fetchYahooQuoteChunk(chunk);
  } catch (error) {
    try {
      const fallback = await fetchCnbcQuotes(chunk);
      if (fallback.length > 0) return fallback;
    } catch {
      // fall through to the original error
    }
    throw error;
  }
}

/**
 * Same as fetchQuotes but tolerates individual batch failures.
 * Used by the movers module so one throttled batch doesn't blank the panel.
 */
export async function fetchQuotesPartial(
  symbols: readonly string[],
): Promise<{ quotes: Quote[]; complete: boolean }> {
  const list = normalizeSymbols(symbols);
  if (list.length === 0) return { quotes: [], complete: true };
  const chunks: string[][] = [];
  for (let i = 0; i < list.length; i += YAHOO_SPARK_BATCH_SIZE) {
    chunks.push(list.slice(i, i + YAHOO_SPARK_BATCH_SIZE));
  }
  const batches = await mapLimit(chunks, 2, async (chunk) => {
    try {
      return await fetchQuotes(chunk);
    } catch {
      return null;
    }
  });
  return {
    quotes: batches.flatMap((batch) => batch ?? []),
    complete: batches.every((batch) => batch !== null) && batches.flat().length === list.length,
  };
}

export async function fetchChart(symbol: string, rangeId: RangeId): Promise<ChartPayload> {
  if (!isValidSymbol(symbol)) throw new ProviderError("Invalid symbol", 400);
  const config = RANGES[rangeId];
  return memoize(`chart:${symbol}:${rangeId}`, config.ttl * 1000, async () => {
    const path =
      `/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?range=${config.yahooRange}&interval=${config.interval}` +
      `&includePrePost=false&events=div%2Csplits&lang=en-US&region=US`;
    return mapChartResult((await fetchJson(path)) as ChartResponse, rangeId);
  });
}

export async function fetchTickerNews(symbol: string, count = 6): Promise<NewsItem[]> {
  if (!isValidSymbol(symbol)) return [];
  return memoize(`news:${symbol}`, 5 * 60_000, async () => {
    const payload = (await fetchJson(
      `/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=0&newsCount=${count}&enableFuzzyQuery=false`,
    )) as SearchResponse;
    return mapNewsItems(payload);
  });
}

export async function fetchMarketNews(count = 12): Promise<NewsItem[]> {
  return memoize("news:market", 5 * 60_000, async () => {
    const payload = (await fetchJson(
      `/v1/finance/search?q=${encodeURIComponent("stock market news")}&quotesCount=0&newsCount=${count}&enableFuzzyQuery=false`,
    )) as SearchResponse;
    return mapNewsItems(payload);
  });
}

export async function fetchFxRates(): Promise<{ rates: Record<string, number>; asOf: string }> {
  return memoize("fx:eur", 6 * 60 * 60_000, async () => {
    try {
      const response = await fetch("https://open.er-api.com/v6/latest/EUR", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!response.ok) throw new ProviderError(`FX provider returned ${response.status}`);
      const payload = (await response.json()) as {
        result?: string;
        rates?: Record<string, number>;
        time_last_update_utc?: string;
      };
      if (payload.result !== "success" || !payload.rates) {
        throw new ProviderError("FX provider returned no rates");
      }
      return {
        rates: payload.rates,
        asOf: payload.time_last_update_utc ?? new Date().toISOString().slice(0, 10),
      };
    } catch {
      try {
        const response = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR", {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        });
        const payload = (await response.json()) as { rates?: Record<string, number>; date?: string };
        if (payload.rates) return { rates: payload.rates, asOf: payload.date ?? "" };
      } catch {
        // fall through to the empty table
      }
      // FX is a nice-to-have: never break the app over it.
      return { rates: {}, asOf: "" };
    }
  });
}
