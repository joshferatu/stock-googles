import { memoize } from "@/lib/cache";
import { ProviderError } from "@/lib/errors";
import type { Instrument } from "@/lib/types";

/** Keyless US-only search fallback (Nasdaq's own autocomplete endpoint). */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 8_000;

interface NasdaqRow {
  symbol?: string;
  name?: string;
  exchange?: string;
  asset?: string;
  subCategory?: string;
}

export function mapNasdaqSearch(payload: unknown): Instrument[] {
  const rows = (payload as { data?: NasdaqRow[] | null } | null)?.data;
  if (!Array.isArray(rows)) return [];
  const out: Instrument[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const symbol = row.symbol?.trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    if (row.asset && !["STOCKS", "ETFS", "ETF"].includes(row.asset)) continue;
    seen.add(symbol);
    const isEtf = row.asset === "ETF" || row.asset === "ETFS" || /etf/i.test(row.subCategory ?? "");
    out.push({
      symbol,
      name: row.name?.trim() || symbol,
      exchange: row.exchange ?? null,
      exchangeName: row.exchange?.replace("-GS", "") ?? null,
      quoteType: isEtf ? "ETF" : "EQUITY",
      sector: null,
      industry: null,
    });
    if (out.length >= 12) break;
  }
  return out;
}

export async function searchNasdaq(query: string): Promise<Instrument[]> {
  const q = query.trim();
  if (!q) return [];
  return memoize(`nasdaq:search:${q.toLowerCase()}`, 2 * 60_000, async () => {
    const response = await fetch(
      `https://api.nasdaq.com/api/autocomplete/slookup/10?search=${encodeURIComponent(q)}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json, text/plain, */*",
          Origin: "https://www.nasdaq.com",
          Referer: "https://www.nasdaq.com/",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      throw new ProviderError(`Nasdaq search returned ${response.status}`, 502);
    }
    return mapNasdaqSearch((await response.json()) as unknown);
  });
}
