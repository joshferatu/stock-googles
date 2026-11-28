import { describe, expect, it } from "vitest";

import {
  DEFAULT_PREFERENCES,
  hasUserState,
  MAX_FAVORITES,
  parseFavorites,
  parsePreferences,
  parseRecentSearches,
  parseUserState,
  RECENT_SEARCH_LIMIT,
} from "@/lib/user-state";

describe("parseUserState", () => {
  it("returns an empty document for garbage", () => {
    expect(parseUserState(null)).toEqual({
      favorites: [],
      preferences: DEFAULT_PREFERENCES,
      recentSearches: [],
    });
    expect(parseUserState("nope")).toEqual(parseUserState(null));
    expect(parseUserState({ favorites: {} })).toEqual(parseUserState(null));
  });

  it("normalises a full document", () => {
    const state = parseUserState({
      favorites: [
        {
          symbol: " AAPL ",
          name: "Apple Inc.",
          exchange: "NMS",
          quoteType: "ETF",
          addedAt: 1_700_000_000_000,
        },
        { symbol: "AAPL", name: "Duplicate" },
        { symbol: "" },
      ],
      preferences: { theme: "light", displayCurrency: "EUR" },
      recentSearches: [{ symbol: "MSFT", name: "Microsoft", exchangeName: "NASDAQ" }],
    });

    expect(state.favorites).toEqual([
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NMS",
        quoteType: "ETF",
        addedAt: 1_700_000_000_000,
      },
    ]);
    expect(state.preferences).toEqual({ theme: "light", displayCurrency: "EUR" });
    expect(state.recentSearches[0]).toMatchObject({
      symbol: "MSFT",
      exchangeName: "NASDAQ",
      quoteType: "EQUITY",
    });
  });
});

describe("bounds", () => {
  it("caps the watchlist", () => {
    const many = Array.from({ length: MAX_FAVORITES + 25 }, (_, index) => ({
      symbol: `S${index}`,
    }));
    expect(parseFavorites(many)).toHaveLength(MAX_FAVORITES);
  });

  it("caps recent searches and drops duplicates", () => {
    const many = Array.from({ length: RECENT_SEARCH_LIMIT + 5 }, (_, index) => ({
      symbol: `S${index}`,
      name: `Stock ${index}`,
    }));
    expect(parseRecentSearches(many)).toHaveLength(RECENT_SEARCH_LIMIT);
    expect(parseRecentSearches([{ symbol: "S1" }, { symbol: "S1" }])).toHaveLength(1);
  });

  it("falls back on unknown preferences", () => {
    expect(parsePreferences({ theme: "purple", displayCurrency: "GBP" })).toEqual(
      DEFAULT_PREFERENCES,
    );
  });
});

describe("hasUserState", () => {
  it("ignores default preferences", () => {
    expect(hasUserState(parseUserState(null))).toBe(false);
    expect(hasUserState({ ...parseUserState(null), favorites: parseFavorites([{ symbol: "AAPL" }]) })).toBe(
      true,
    );
    expect(hasUserState(parseUserState({ preferences: { theme: "light" } }))).toBe(true);
  });
});
