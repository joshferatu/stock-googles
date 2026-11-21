export const RANGE_IDS = ["1D", "1W", "1M", "6M", "1Y", "5Y", "MAX"] as const;

export type RangeId = (typeof RANGE_IDS)[number];

export interface RangeConfig {
  id: RangeId;
  label: string;
  yahooRange: string;
  interval: string;
  /** Server cache TTL in seconds. */
  ttl: number;
  intraday: boolean;
}

export const RANGES: Record<RangeId, RangeConfig> = {
  "1D": { id: "1D", label: "1D", yahooRange: "1d", interval: "5m", ttl: 30, intraday: true },
  "1W": { id: "1W", label: "1W", yahooRange: "5d", interval: "30m", ttl: 120, intraday: true },
  "1M": { id: "1M", label: "1M", yahooRange: "1mo", interval: "1d", ttl: 300, intraday: false },
  "6M": { id: "6M", label: "6M", yahooRange: "6mo", interval: "1d", ttl: 600, intraday: false },
  "1Y": { id: "1Y", label: "1Y", yahooRange: "1y", interval: "1d", ttl: 900, intraday: false },
  "5Y": { id: "5Y", label: "5Y", yahooRange: "5y", interval: "1wk", ttl: 1800, intraday: false },
  // Yahoo caps very long histories at a 3-month granularity, which is plenty for a full-history view.
  MAX: { id: "MAX", label: "MAX", yahooRange: "max", interval: "1mo", ttl: 1800, intraday: false },
};

export const DEFAULT_RANGE: RangeId = "1D";

export function parseRange(value: string | null | undefined): RangeId | null {
  if (!value) return null;
  return RANGE_IDS.includes(value as RangeId) ? (value as RangeId) : null;
}

/** Lightweight-charts tick formatters, both in the exchange's local clock. */
export function formatAxisTick(time: number, intraday: boolean): string {
  const date = new Date(time * 1000);
  if (intraday) {
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function formatCrosshairTime(time: number, intraday: boolean): string {
  const date = new Date(time * 1000);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
  if (!intraday) return day;
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} · ${hours}:${minutes}`;
}
