import { beforeEach, describe, expect, it } from "vitest";

import { parseFavorites, useFavorites } from "@/lib/favorites-store";

const base = {
  symbol: "AAPL",
  name: "Apple Inc.",
  exchange: "NASDAQ",
  quoteType: "EQUITY" as const,
};

describe("favorites store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useFavorites.setState({ favorites: [] });
  });

  it("adds, ignores duplicates and toggles", () => {
    const store = useFavorites.getState();
    store.addFavorite(base);
    store.addFavorite({ ...base, name: "Duplicate" });
    expect(useFavorites.getState().favorites).toHaveLength(1);
    expect(useFavorites.getState().favorites[0].name).toBe("Apple Inc.");

    useFavorites.getState().toggleFavorite(base);
    expect(useFavorites.getState().favorites).toHaveLength(0);

    useFavorites.getState().toggleFavorite(base);
    expect(useFavorites.getState().favorites).toHaveLength(1);
  });

  it("keeps newest favourites first and removes by symbol", () => {
    useFavorites.getState().addFavorite(base);
    useFavorites.getState().addFavorite({ ...base, symbol: "MSFT", name: "Microsoft" });
    expect(useFavorites.getState().favorites.map((favorite) => favorite.symbol)).toEqual(["MSFT", "AAPL"]);

    useFavorites.getState().removeFavorite("AAPL");
    expect(useFavorites.getState().favorites.map((favorite) => favorite.symbol)).toEqual(["MSFT"]);
  });

  it("imports valid entries, merges by symbol and defaults bad fields", () => {
    useFavorites.getState().addFavorite(base);
    const count = useFavorites.getState().importFavorites([
      { symbol: "MSFT", name: "Microsoft", quoteType: "NOT_A_TYPE" },
      { symbol: "AAPL", name: "Should not overwrite" },
      { name: "No symbol" },
      "nope",
      null,
    ]);
    expect(count).toBe(2);
    const favorites = useFavorites.getState().favorites;
    expect(favorites.map((favorite) => favorite.symbol).sort()).toEqual(["AAPL", "MSFT"]);
    expect(favorites.find((favorite) => favorite.symbol === "AAPL")?.name).toBe("Apple Inc.");
    expect(favorites.find((favorite) => favorite.symbol === "MSFT")?.quoteType).toBe("EQUITY");
    expect(favorites.find((favorite) => favorite.symbol === "MSFT")?.addedAt).toBeTypeOf("number");
  });

  it("clears everything", () => {
    useFavorites.getState().addFavorite(base);
    useFavorites.getState().clearFavorites();
    expect(useFavorites.getState().favorites).toEqual([]);
  });
});

describe("parseFavorites", () => {
  it("rejects non-arrays and malformed entries", () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites({})).toEqual([]);
    expect(parseFavorites([{ symbol: "" }, { symbol: 42 }])).toEqual([]);
    expect(parseFavorites([{ symbol: "AAPL" }])[0]).toMatchObject({
      symbol: "AAPL",
      name: "AAPL",
      exchange: null,
      quoteType: "EQUITY",
    });
  });
});
