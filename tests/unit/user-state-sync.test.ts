import { beforeEach, describe, expect, it } from "vitest";

import { FAVORITES_STORAGE_KEY, useFavorites } from "@/lib/favorites-store";
import { RECENT_SEARCHES_STORAGE_KEY, useRecentSearches } from "@/lib/recent-searches";
import {
  SETTINGS_STORAGE_KEY,
  THEME_STORAGE_KEY,
  useSettings,
} from "@/lib/settings-store";
import { parseUserState } from "@/lib/user-state";
import {
  applyUserState,
  clearLocalUserData,
  snapshotUserState,
} from "@/lib/user-state-sync";

const SERVER_STATE = parseUserState({
  favorites: [
    { symbol: "AAPL", name: "Apple Inc.", exchange: "NMS", quoteType: "EQUITY", addedAt: 1 },
  ],
  preferences: { theme: "light", displayCurrency: "EUR" },
  recentSearches: [{ symbol: "MSFT", name: "Microsoft", exchangeName: "NASDAQ" }],
});

beforeEach(() => {
  window.localStorage.clear();
  useFavorites.setState({ favorites: [] });
  useRecentSearches.setState({ items: [] });
  useSettings.setState({ theme: "dark", displayCurrency: "native" });
});

describe("applyUserState", () => {
  it("writes the server document into all three stores and the theme", () => {
    applyUserState(SERVER_STATE);

    expect(useFavorites.getState().favorites).toEqual(SERVER_STATE.favorites);
    expect(useRecentSearches.getState().items).toEqual(SERVER_STATE.recentSearches);
    expect(useSettings.getState().theme).toBe("light");
    expect(useSettings.getState().displayCurrency).toBe("EUR");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("round-trips through snapshotUserState", () => {
    applyUserState(SERVER_STATE);
    expect(snapshotUserState()).toEqual(SERVER_STATE);
  });
});

describe("clearLocalUserData", () => {
  it("empties the stores and the local cache", () => {
    applyUserState(SERVER_STATE);
    window.localStorage.setItem("sg:user-state:pending:v1", "1");
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, "{}");

    clearLocalUserData();

    expect(useFavorites.getState().favorites).toEqual([]);
    expect(useRecentSearches.getState().items).toEqual([]);
    expect(useSettings.getState()).toMatchObject({ theme: "dark", displayCurrency: "native" });
    for (const key of [
      FAVORITES_STORAGE_KEY,
      SETTINGS_STORAGE_KEY,
      THEME_STORAGE_KEY,
      RECENT_SEARCHES_STORAGE_KEY,
      "sg:user-state:pending:v1",
      "sg:query-cache:v1",
    ]) {
      expect(window.localStorage.getItem(key)).toBeNull();
    }
  });
});
