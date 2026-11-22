import { describe, expect, it } from "vitest";

import { googleNewsQuery, parseGoogleNewsRss } from "@/lib/google-news";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>"AAPL stock" - Google News</title>
    <item>
      <title>Apple unveils new chips - Reuters</title>
      <link>https://news.google.com/rss/articles/abc</link>
      <pubDate>Fri, 21 Nov 2026 12:00:00 GMT</pubDate>
      <source url="https://www.reuters.com">Reuters</source>
    </item>
    <item>
      <title>Markets slide as yields climb</title>
      <link>https://news.google.com/rss/articles/def</link>
      <pubDate>Fri, 21 Nov 2026 10:00:00 GMT</pubDate>
      <source url="https://www.ft.com">Financial Times</source>
    </item>
    <item>
      <title>Duplicate link</title>
      <link>https://news.google.com/rss/articles/abc</link>
      <pubDate>Fri, 21 Nov 2026 09:00:00 GMT</pubDate>
      <source url="https://example.com">Example</source>
    </item>
    <item>
      <link>https://example.com/no-title</link>
    </item>
  </channel>
</rss>`;

describe("parseGoogleNewsRss", () => {
  it("parses items, strips publisher suffixes and dedupes", () => {
    const items = parseGoogleNewsRss(RSS, "AAPL", 10);
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.title)).toEqual([
      "Apple unveils new chips",
      "Markets slide as yields climb",
    ]);
    expect(items[0]).toMatchObject({
      publisher: "Reuters",
      tickers: ["AAPL"],
    });
    expect(items[0].publishedAt).toBeGreaterThan(items[1].publishedAt);
  });

  it("attaches no tickers for market news", () => {
    const items = parseGoogleNewsRss(RSS, null, 1);
    expect(items[0].tickers).toEqual([]);
  });

  it("returns an empty list for malformed XML", () => {
    expect(parseGoogleNewsRss("not xml", "AAPL")).toEqual([]);
  });
});

describe("googleNewsQuery", () => {
  it("builds sensible queries from canonical symbols", () => {
    expect(googleNewsQuery("AAPL")).toBe("AAPL stock");
    expect(googleNewsQuery("TEF.MC")).toBe("TEF stock");
    expect(googleNewsQuery("^IXIC")).toBe("IXIC index");
  });
});
