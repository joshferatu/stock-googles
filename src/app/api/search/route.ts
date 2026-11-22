import { z } from "zod";

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

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) return jsonError("A search query is required.", 400);

  const query = parsed.data.q;
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
    const { message, status } = providerErrorMessage(lastError);
    return jsonError(message, status);
  }

  return jsonOk(
    { query, results, provider, fetchedAt: Date.now() },
    { sMaxAge: 120, staleWhileRevalidate: 600 },
  );
}
