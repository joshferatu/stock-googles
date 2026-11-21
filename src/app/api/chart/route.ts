import { jsonError, jsonOk, providerErrorMessage } from "@/lib/http";
import { parseRange, RANGES, type RangeId } from "@/lib/ranges";
import { fetchChart, isValidSymbol } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim();
  const range = parseRange(url.searchParams.get("range")) ?? ("1D" as RangeId);

  if (!symbol || !isValidSymbol(symbol)) return jsonError("Invalid symbol.", 400);

  try {
    const chart = await fetchChart(symbol, range);
    return jsonOk(chart, { sMaxAge: RANGES[range].ttl, staleWhileRevalidate: 600 });
  } catch (error) {
    const { message, status } = providerErrorMessage(error);
    return jsonError(message, status);
  }
}
