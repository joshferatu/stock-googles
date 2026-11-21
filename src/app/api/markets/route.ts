import { jsonError, jsonOk, providerErrorMessage } from "@/lib/http";
import type { MarketsPayload } from "@/lib/types";
import { MARKET_INDICES } from "@/lib/universe";
import { fetchQuotes } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const quotes = await fetchQuotes(MARKET_INDICES.map((index) => index.symbol));
    const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
    const indices = MARKET_INDICES.flatMap((index) => {
      const quote = bySymbol.get(index.symbol);
      return quote ? [quote] : [];
    });
    const payload: MarketsPayload = { indices, asOf: Math.floor(Date.now() / 1000) };
    return jsonOk(payload, { sMaxAge: 60, staleWhileRevalidate: 300 });
  } catch (error) {
    const { message, status } = providerErrorMessage(error);
    return jsonError(message, status);
  }
}
