import type { Quote } from "@/lib/types";

/**
 * Yahoo's screener endpoints are closed, so movers come from a fixed universe.
 * Ranks by absolute day move, ignoring quotes without a usable change value.
 */
export function computeMovers(
  quotes: readonly Quote[],
  limit = 8,
): { gainers: Quote[]; losers: Quote[] } {
  const usable = quotes.filter(
    (quote) =>
      typeof quote.changePercent === "number" &&
      Number.isFinite(quote.changePercent) &&
      quote.changePercent !== 0 &&
      quote.price != null &&
      quote.quoteType !== "INDEX",
  );
  const sorted = [...usable].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  return {
    gainers: sorted.filter((quote) => (quote.changePercent ?? 0) > 0).slice(0, limit),
    losers: sorted
      .filter((quote) => (quote.changePercent ?? 0) < 0)
      .slice(-limit)
      .reverse(),
  };
}
