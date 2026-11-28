import { cached } from "@/lib/cache";
import { jsonError, jsonOk, providerErrorMessage } from "@/lib/http";
import type { MarketsPayload } from "@/lib/types";
import { MARKET_INDICES } from "@/lib/universe";
import { fetchQuotes } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MARKETS_TTL_MS = 60_000;

export async function GET() {
  try {
    const { value, meta } = await cached<MarketsPayload>("markets", { ttlMs: MARKETS_TTL_MS }, async () => {
      const quotes = await fetchQuotes(MARKET_INDICES.map((index) => index.symbol));
      const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
      const indices = MARKET_INDICES.flatMap((index) => {
        const quote = bySymbol.get(index.symbol);
        return quote ? [quote] : [];
      });
      return { indices, asOf: Math.floor(Date.now() / 1000), stale: false };
    });
    return jsonOk({ ...value, stale: meta.stale }, { sMaxAge: 60, staleWhileRevalidate: 300 });
  } catch (error) {
    const { message, status } = providerErrorMessage(error);
    return jsonError(message, status);
  }
}
