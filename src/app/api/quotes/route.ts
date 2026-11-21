import { jsonError, jsonOk, providerErrorMessage } from "@/lib/http";
import { fetchQuotes, normalizeSymbols } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = normalizeSymbols(url.searchParams.get("symbols") ?? "");
  if (symbols.length === 0) return jsonError("Provide at least one valid symbol.", 400);

  try {
    const quotes = await fetchQuotes(symbols);
    return jsonOk({ quotes, fetchedAt: Date.now() }, { sMaxAge: 30, staleWhileRevalidate: 300 });
  } catch (error) {
    const { message, status } = providerErrorMessage(error);
    return jsonError(message, status);
  }
}
