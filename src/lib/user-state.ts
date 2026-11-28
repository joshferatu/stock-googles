/**
 * User-owned state: favourites, display preferences and recent searches.
 *
 * This module is shared by the browser (Zustand stores, offline cache) and the
 * server (Neon repository, route validation). It must stay free of side effects
 * and of any `"use client"`/Node-only import so both sides can use it.
 *
 * The database is the source of truth; `localStorage` is a cache so the UI can
 * paint instantly and keep working when `/api/user/state` is unreachable.
 */

import type { DisplayCurrency } from "@/lib/fx";
import type { QuoteType } from "@/lib/types";

export type Theme = "dark" | "light";

export const THEMES: readonly Theme[] = ["dark", "light"];

export const USER_STATE_VERSION = 1;
/** Upper bound for a watchlist. Protects both the DB row and the quote fan-out. */
export const MAX_FAVORITES = 200;
export const RECENT_SEARCH_LIMIT = 8;

export const QUOTE_TYPES: readonly QuoteType[] = [
  "EQUITY",
  "ETF",
  "INDEX",
  "MUTUALFUND",
  "OTHER",
] as const;

export const DISPLAY_CURRENCIES: readonly DisplayCurrency[] = ["native", "EUR", "USD"] as const;

export interface Favorite {
  symbol: string;
  name: string;
  exchange: string | null;
  quoteType: QuoteType;
  addedAt: number;
}

export type FavoriteInput = Omit<Favorite, "addedAt"> & { addedAt?: number };

export interface UserPreferences {
  theme: Theme;
  displayCurrency: DisplayCurrency;
}

export interface RecentSearch {
  symbol: string;
  name: string;
  exchangeName: string | null;
  quoteType: QuoteType;
}

export interface UserState {
  favorites: Favorite[];
  preferences: UserPreferences;
  recentSearches: RecentSearch[];
}

/** Shape returned by `GET /api/user/state`. */
export interface UserStateResponse {
  /** False when the account has no row yet, i.e. nothing was ever saved. */
  exists: boolean;
  updatedAt: string | null;
  state: UserState;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  displayCurrency: "native",
};

export const EMPTY_USER_STATE: UserState = {
  favorites: [],
  preferences: DEFAULT_PREFERENCES,
  recentSearches: [],
};

function isQuoteType(value: unknown): value is QuoteType {
  return typeof value === "string" && (QUOTE_TYPES as readonly string[]).includes(value);
}

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === "string" && (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Accepts anything; returns a bounded, de-duplicated watchlist. */
export function parseFavorites(value: unknown): Favorite[] {
  if (!Array.isArray(value)) return [];
  const out: Favorite[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (out.length >= MAX_FAVORITES) break;
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const symbol = text(item.symbol);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({
      symbol,
      name: text(item.name) || symbol,
      exchange: typeof item.exchange === "string" ? item.exchange : null,
      quoteType: isQuoteType(item.quoteType) ? item.quoteType : "EQUITY",
      addedAt:
        typeof item.addedAt === "number" && Number.isFinite(item.addedAt)
          ? item.addedAt
          : Date.now(),
    });
  }
  return out;
}

export function parsePreferences(value: unknown): UserPreferences {
  const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    theme: isTheme(item.theme) ? item.theme : DEFAULT_PREFERENCES.theme,
    displayCurrency: isDisplayCurrency(item.displayCurrency)
      ? item.displayCurrency
      : DEFAULT_PREFERENCES.displayCurrency,
  };
}

export function parseRecentSearches(value: unknown): RecentSearch[] {
  if (!Array.isArray(value)) return [];
  const out: RecentSearch[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (out.length >= RECENT_SEARCH_LIMIT) break;
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const symbol = text(item.symbol);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({
      symbol,
      name: text(item.name) || symbol,
      exchangeName: typeof item.exchangeName === "string" ? item.exchangeName : null,
      quoteType: isQuoteType(item.quoteType) ? item.quoteType : "EQUITY",
    });
  }
  return out;
}

export function parseUserState(value: unknown): UserState {
  const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    favorites: parseFavorites(item.favorites),
    preferences: parsePreferences(item.preferences),
    recentSearches: parseRecentSearches(item.recentSearches),
  };
}

/** True when there is something worth writing to the server. */
export function hasUserState(state: UserState): boolean {
  return (
    state.favorites.length > 0 ||
    state.recentSearches.length > 0 ||
    state.preferences.theme !== DEFAULT_PREFERENCES.theme ||
    state.preferences.displayCurrency !== DEFAULT_PREFERENCES.displayCurrency
  );
}
