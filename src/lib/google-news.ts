import { memoize } from "@/lib/cache";
import type { NewsItem } from "@/lib/types";

/** Keyless news fallback: Google News RSS. */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 9_000;

interface ParsedItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: number;
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function tag(block: string, name: string): string | null {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return match ? decodeEntities(match[1]) : null;
}

export function parseGoogleNewsRss(xml: string, ticker: string | null, limit = 8): NewsItem[] {
  const items: ParsedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const rawTitle = tag(block, "title");
    const link = tag(block, "link");
    if (!rawTitle || !link) continue;
    const publisher = tag(block, "source") ?? "Google News";
    const title = rawTitle.endsWith(` - ${publisher}`)
      ? rawTitle.slice(0, -(publisher.length + 3)).trim()
      : rawTitle;
    const pubDate = tag(block, "pubDate");
    const publishedAt = pubDate ? Math.floor(Date.parse(pubDate) / 1000) : 0;
    items.push({
      title,
      link,
      publisher,
      publishedAt: Number.isFinite(publishedAt) ? publishedAt : 0,
    });
  }

  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    })
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, limit)
    .map((item) => ({
      id: item.link,
      title: item.title,
      publisher: item.publisher,
      link: item.link,
      publishedAt: item.publishedAt,
      tickers: ticker ? [ticker] : [],
    }));
}

export async function fetchGoogleNews(
  query: string,
  ticker: string | null,
  limit = 8,
): Promise<NewsItem[]> {
  const q = query.trim();
  if (!q) return [];
  return memoize(`gnews:${q.toLowerCase()}:${limit}`, 10 * 60_000, async () => {
    try {
      const url =
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}` +
        `&hl=en-US&gl=US&ceid=US:en`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/rss+xml, application/xml, text/xml",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Google News returned ${response.status}`);
      }
      return parseGoogleNewsRss(await response.text(), ticker, limit);
    } catch (error) {
      // Rethrow so memoize does not cache a transient failure as "no news".
      throw error;
    }
  });
}

export function googleNewsQuery(symbol: string): string {
  const base = symbol.replace(/^\^/, "").split(".")[0];
  return symbol.startsWith("^") ? `${base} index` : `${base} stock`;
}
