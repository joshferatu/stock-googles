import { cached } from "@/lib/cache";
import { jsonError, jsonOk, providerErrorMessage } from "@/lib/http";
import { fetchQuotes, normalizeSymbols } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/** Quotes refresh often; the shared cache mostly absorbs repeat visits. */
const QUOTES_TTL_MS = 30_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = normalizeSymbols(url.searchParams.get("symbols") ?? "");
  if (symbols.length === 0) return jsonError("Provide at least one valid symbol.", 400);

  try {
    const { value, meta } = await cached(`quotes:${symbols.join(",")}`, { ttlMs: QUOTES_TTL_MS }, async () => ({
      quotes: await fetchQuotes(symbols),
      fetchedAt: Date.now(),
    }));
    return jsonOk({ ...value, stale: meta.stale }, { sMaxAge: 30, staleWhileRevalidate: 300 });
  } catch (error) {
    const { message, status } = providerErrorMessage(error);
    return jsonError(message, status);
  }
}
