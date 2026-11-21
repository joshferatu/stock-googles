/** Shared domain types used by both server routes and client components. */

export type QuoteType = "EQUITY" | "ETF" | "INDEX" | "MUTUALFUND" | "OTHER";

export type MarketState = "PRE" | "OPEN" | "POST" | "CLOSED" | "UNKNOWN";

export interface Quote {
  symbol: string;
  name: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  exchange: string | null;
  exchangeName: string | null;
  quoteType: QuoteType;
  marketState: MarketState;
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  volume: number | null;
  /** Unix seconds of the last trade reported by the provider. */
  asOf: number | null;
  /** IANA timezone of the listing exchange. */
  timezone: string | null;
  /** Short intraday close series used for mini charts. */
  sparkline: number[];
}

export interface Instrument {
  symbol: string;
  name: string;
  exchange: string | null;
  exchangeName: string | null;
  quoteType: QuoteType;
  sector: string | null;
  industry: string | null;
}

export interface ChartPoint {
  /** Unix seconds, already shifted to the exchange's local clock. */
  time: number;
  value: number;
}

export interface ChartPayload {
  symbol: string;
  currency: string | null;
  exchangeName: string | null;
  timezone: string | null;
  /** Exchange UTC offset in seconds, applied to every point's time. */
  offset: number;
  range: string;
  interval: string;
  intraday: boolean;
  baseline: number | null;
  performance: number | null;
  series: ChartPoint[];
}

export interface NewsItem {
  id: string;
  title: string;
  publisher: string;
  link: string;
  /** Unix seconds. */
  publishedAt: number;
  /** Symbols the article was surfaced for. */
  tickers: string[];
}

export interface MoversPayload {
  gainers: Quote[];
  losers: Quote[];
  asOf: number;
  universe: number;
  partial: boolean;
}

export interface MarketsPayload {
  indices: Quote[];
  asOf: number;
}

export interface FxPayload {
  base: string;
  rates: Record<string, number>;
  asOf: string;
  /** Currencies that could not be resolved by any provider. */
  missing: string[];
}

export interface ApiError {
  error: string;
}
