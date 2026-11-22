import { memoize } from "@/lib/cache";
import { ProviderError } from "@/lib/errors";
import type { ChartPayload, Instrument } from "@/lib/types";
import { RANGES, type RangeId } from "@/lib/ranges";
import { deriveStockAnalysisId, saIdToSymbol } from "@/lib/symbols";

/**
 * Keyless fallback provider for search and US daily history.
 * No intraday bars: 1D/1W/1M fall back to daily closes with a clear note.
 */

const BASE = "https://stockanalysis.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 9_000;

export interface SaSearchRow {
  id?: string;
  s?: string;
  t?: string;
  n?: string;
  st?: string;
}

export interface SaHistoryRow {
  t?: string;
  c?: number;
  o?: number;
  h?: number;
  l?: number;
  v?: number;
  a?: number;
  ch?: number;
}

interface SaHistoryResponse {
  status?: number;
  message?: string;
  data?: SaHistoryRow[] | { data?: SaHistoryRow[] };
}

const SA_RANGE: Record<RangeId, string> = {
  "1D": "1M",
  "1W": "1M",
  "1M": "1M",
  "6M": "6M",
  "1Y": "1Y",
  "5Y": "5Y",
  MAX: "MAX",
};

/** How many trailing daily points represent each range on the fallback chart. */
const TRAILING_POINTS: Partial<Record<RangeId, number>> = {
  "1D": 2,
  "1W": 5,
  "1M": 22,
};

export function mapStockAnalysisSearch(payload: unknown): Instrument[] {
  const rows = (payload as { data?: SaSearchRow[] } | null)?.data;
  if (!Array.isArray(rows)) return [];
  const out: Instrument[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row?.s || !row.n) continue;
    if (row.t && !["s", "sy", "e"].includes(row.t)) continue;
    const mapped = saIdToSymbol(row.s);
    if (!mapped || seen.has(mapped.symbol)) continue;
    seen.add(mapped.symbol);
    out.push({
      symbol: mapped.symbol,
      name: row.n,
      exchange: null,
      exchangeName: mapped.exchangeName,
      quoteType: row.st === "e" || row.t === "e" ? "ETF" : "EQUITY",
      sector: null,
      industry: null,
    });
    if (out.length >= 15) break;
  }
  return out;
}

export function mapStockAnalysisHistory(
  payload: SaHistoryResponse,
  symbol: string,
  rangeId: RangeId,
): ChartPayload {
  const raw = Array.isArray(payload.data) ? payload.data : payload.data?.data;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ProviderError("No historical data available from the fallback provider", 404);
  }

  const points = raw
    .map((row) => {
      const close = typeof row.c === "number" ? row.c : null;
      const time = row.t ? Date.parse(row.t.includes("T") ? row.t : `${row.t}T00:00:00Z`) / 1000 : null;
      if (close == null || !Number.isFinite(close) || time == null || !Number.isFinite(time)) return null;
      return { time, value: Math.round(close * 10000) / 10000 };
    })
    .filter((point): point is { time: number; value: number } => point !== null)
    .sort((a, b) => a.time - b.time);

  if (points.length < 2) {
    throw new ProviderError("Not enough historical data from the fallback provider", 404);
  }

  const trailing = TRAILING_POINTS[rangeId];
  const series = trailing ? points.slice(-trailing) : points;
  if (series.length < 2) {
    throw new ProviderError("Not enough historical data from the fallback provider", 404);
  }

  const baseline =
    rangeId === "1D" ? series[series.length - 2].value : series[0].value;
  const last = series[series.length - 1].value;
  const performance = baseline > 0 ? (last - baseline) / baseline : null;

  return {
    symbol,
    currency: null,
    exchangeName: null,
    timezone: null,
    offset: 0,
    range: rangeId,
    interval: "1d",
    intraday: false,
    baseline,
    performance,
    source: "stockanalysis",
    note: "Daily closes from StockAnalysis — intraday data is unavailable right now.",
    series,
  };
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(BASE + path, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ProviderError(`Fallback provider returned ${response.status}`, 502);
  }
  return (await response.json()) as unknown;
}

export async function searchStockAnalysis(query: string): Promise<Instrument[]> {
  const q = query.trim();
  if (!q) return [];
  return memoize(`sa:search:${q.toLowerCase()}`, 2 * 60_000, async () => {
    const payload = await getJson(`/api/search?q=${encodeURIComponent(q)}`);
    return mapStockAnalysisSearch(payload);
  });
}

export async function fetchStockAnalysisChart(symbol: string, rangeId: RangeId): Promise<ChartPayload> {
  const id = deriveStockAnalysisId(symbol);
  if (!id) {
    throw new ProviderError("The fallback chart provider does not cover this symbol", 404);
  }
  return memoize(`sa:chart:${id}:${rangeId}`, RANGES[rangeId].ttl * 1000, async () => {
    const payload = (await getJson(
      `/api/symbol/s/${encodeURIComponent(id)}/history?range=${SA_RANGE[rangeId]}`,
    )) as SaHistoryResponse;
    return mapStockAnalysisHistory(payload, symbol, rangeId);
  });
}
