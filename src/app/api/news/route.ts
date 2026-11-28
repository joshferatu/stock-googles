import { cached } from "@/lib/cache";
import { jsonError, jsonOk, providerErrorMessage } from "@/lib/http";
import type { NewsItem } from "@/lib/types";
import { fetchMarketNews, fetchTickerNews, normalizeSymbols } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_NEWS_SYMBOLS = 8;
const NEWS_TTL_MS = 10 * 60_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = normalizeSymbols(url.searchParams.get("symbols") ?? "").slice(0, MAX_NEWS_SYMBOLS);
  const includeMarket = url.searchParams.get("market") === "1";
  const limit = Math.min(40, Math.max(1, Number(url.searchParams.get("limit") ?? 24) || 24));

  if (symbols.length === 0 && !includeMarket) {
    return jsonError("Provide symbols or request market news.", 400);
  }

  const key = `news:${symbols.join(",")}:${includeMarket ? "market" : "symbols"}:${limit}`;

  try {
    const { value, meta } = await cached(key, { ttlMs: NEWS_TTL_MS }, async () => {
      const [perSymbol, market] = await Promise.all([
        Promise.allSettled(symbols.map((symbol) => fetchTickerNews(symbol, 5))),
        includeMarket ? fetchMarketNews(12).catch(() => [] as NewsItem[]) : Promise.resolve([] as NewsItem[]),
      ]);

      const merged = new Map<string, NewsItem>();
      perSymbol.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const symbol = symbols[index];
        for (const item of result.value) {
          const existing = merged.get(item.link);
          if (existing) {
            if (!existing.tickers.includes(symbol)) existing.tickers.push(symbol);
          } else {
            merged.set(item.link, { ...item, tickers: Array.from(new Set([...item.tickers, symbol])) });
          }
        }
      });

      for (const item of market) {
        if (!merged.has(item.link)) merged.set(item.link, item);
      }

      const items = Array.from(merged.values())
        .sort((a, b) => b.publishedAt - a.publishedAt)
        .slice(0, limit);

      return { items, symbols, fetchedAt: Date.now(), stale: false };
    });

    return jsonOk(
      { ...value, stale: meta.stale },
      { sMaxAge: 300, staleWhileRevalidate: 900 },
    );
  } catch (error) {
    const { message, status } = providerErrorMessage(error);
    return jsonError(message, status);
  }
}
