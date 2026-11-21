import { memoize } from "@/lib/cache";
import { jsonError, jsonOk, providerErrorMessage } from "@/lib/http";
import { computeMovers } from "@/lib/movers";
import type { MoversPayload } from "@/lib/types";
import { MOVERS_UNIVERSE } from "@/lib/universe";
import { fetchQuotesPartial } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Movers are expensive upstream (7 batched quotes), so share one computation. */
const MOVERS_TTL_MS = 8 * 60_000;

export async function GET() {
  try {
    const payload = await memoize<MoversPayload>("movers", MOVERS_TTL_MS, async () => {
      const { quotes, complete } = await fetchQuotesPartial(MOVERS_UNIVERSE);
      if (quotes.length === 0) {
        throw new Error("No quote data available for the movers universe.");
      }
      const { gainers, losers } = computeMovers(quotes, 8);
      return {
        gainers,
        losers,
        asOf: Math.floor(Date.now() / 1000),
        universe: quotes.length,
        partial: !complete,
      };
    });

    return jsonOk(payload, { sMaxAge: 300, staleWhileRevalidate: 1200 });
  } catch (error) {
    const { message, status } = providerErrorMessage(error);
    return jsonError(message, status);
  }
}
