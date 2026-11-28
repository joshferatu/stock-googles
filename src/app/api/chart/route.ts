import { cached } from "@/lib/cache";
import { jsonError, jsonOk, providerErrorMessage } from "@/lib/http";
import { parseRange, RANGES, type RangeId } from "@/lib/ranges";
import { fetchStockAnalysisChart } from "@/lib/stockanalysis";
import type { ChartPayload } from "@/lib/types";
import { fetchChart, isValidSymbol } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim();
  const range = parseRange(url.searchParams.get("range")) ?? ("1D" as RangeId);

  if (!symbol || !isValidSymbol(symbol)) return jsonError("Invalid symbol.", 400);

  const load = async (): Promise<ChartPayload> => {
    try {
      return await fetchChart(symbol, range);
    } catch (primaryError) {
      try {
        return await fetchStockAnalysisChart(symbol, range);
      } catch {
        throw primaryError;
      }
    }
  };

  try {
    const { value, meta } = await cached<ChartPayload>(`chart:${symbol}:${range}`, {
      ttlMs: RANGES[range].ttl * 1000,
    }, load);

    return jsonOk({ ...value, stale: meta.stale }, { sMaxAge: RANGES[range].ttl, staleWhileRevalidate: 600 });
  } catch (error) {
    const { message, status } = providerErrorMessage(error);
    return jsonError(message, status);
  }
}
