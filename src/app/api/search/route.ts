import { z } from "zod";

import { cached } from "@/lib/cache";
import { jsonError, jsonOk, providerErrorMessage } from "@/lib/http";
import { searchNasdaq } from "@/lib/nasdaq";
import { searchStockAnalysis } from "@/lib/stockanalysis";
import { searchTradingView } from "@/lib/tradingview";
import type { Instrument } from "@/lib/types";
import { searchInstruments } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  q: z.string().trim().min(1).max(80),
});

/** Short TTL: the key space is per query, but repeats are common enough to share. */
const SEARCH_TTL_MS = 2 * 60_000;

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) return jsonError("A search query is required.", 400);

  const query = parsed.data.q;

  const load = async () => {
    let results: Instrument[] = [];
    let provider = "yahoo";
    let succeeded = false;
    let lastError: unknown;

    // Yahoo is the richest source; the rest are keyless fallbacks for throttled
    // cloud IPs. An empty result still falls through so obscure listings appear.
    try {
      results = await searchInstruments(query);
      succeeded = true;
    } catch (error) {
      lastError = error;
    }

    if (results.length === 0) {
      try {
        results = await searchStockAnalysis(query);
        provider = "stockanalysis";
        succeeded = true;
      } catch (error) {
        lastError = error;
      }
    }

    if (results.length === 0) {
      try {
        results = await searchTradingView(query);
        provider = "tradingview";
        succeeded = true;
      } catch (error) {
        lastError = error;
      }
    }

    if (results.length === 0) {
      try {
        results = await searchNasdaq(query);
        provider = "nasdaq";
        succeeded = true;
      } catch (error) {
        lastError = error;
      }
    }

    if (!succeeded && results.length === 0) {
      throw lastError ?? new Error("No search provider responded.");
    }

    return { query, results, provider, fetchedAt: Date.now(), stale: false };
  };

  try {
    const { value, meta } = await cached(`search:${query.toLowerCase()}`, { ttlMs: SEARCH_TTL_MS }, load);
    return jsonOk({ ...value, stale: meta.stale }, { sMaxAge: 120, staleWhileRevalidate: 600 });
  } catch (error) {
    const { message, status } = providerErrorMessage(error);
    return jsonError(message, status);
  }
}
