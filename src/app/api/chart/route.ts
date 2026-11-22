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

  let chart: ChartPayload;
  try {
    chart = await fetchChart(symbol, range);
  } catch (primaryError) {
    try {
      chart = await fetchStockAnalysisChart(symbol, range);
    } catch {
      const { message, status } = providerErrorMessage(primaryError);
      return jsonError(message, status);
    }
  }

  return jsonOk(chart, { sMaxAge: RANGES[range].ttl, staleWhileRevalidate: 600 });
}
