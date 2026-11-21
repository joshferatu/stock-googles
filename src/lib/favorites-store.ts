"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type { QuoteType } from "@/lib/types";

export interface Favorite {
  symbol: string;
  name: string;
  exchange: string | null;
  quoteType: QuoteType;
  addedAt: number;
}

export type FavoriteInput = Omit<Favorite, "addedAt"> & { addedAt?: number };

interface FavoritesState {
  favorites: Favorite[];
  addFavorite: (favorite: FavoriteInput) => void;
  removeFavorite: (symbol: string) => void;
  toggleFavorite: (favorite: FavoriteInput) => void;
  clearFavorites: () => void;
  importFavorites: (items: unknown) => number;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const FAVORITES_STORAGE_KEY = "sg:favorites:v1";

const QUOTE_TYPES: QuoteType[] = ["EQUITY", "ETF", "INDEX", "MUTUALFUND", "OTHER"];

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (favorite) => {
        const current = get().favorites;
        if (current.some((item) => item.symbol === favorite.symbol)) return;
        set({
          favorites: [
            { ...favorite, addedAt: favorite.addedAt ?? Date.now() },
            ...current,
          ],
        });
      },
      removeFavorite: (symbol) => {
        set({ favorites: get().favorites.filter((item) => item.symbol !== symbol) });
      },
      toggleFavorite: (favorite) => {
        const exists = get().favorites.some((item) => item.symbol === favorite.symbol);
        if (exists) get().removeFavorite(favorite.symbol);
        else get().addFavorite(favorite);
      },
      clearFavorites: () => set({ favorites: [] }),
      importFavorites: (items) => {
        const parsed = parseFavorites(items);
        if (parsed.length === 0) return 0;
        const existing = new Map(get().favorites.map((item) => [item.symbol, item]));
        for (const item of parsed) {
          if (!existing.has(item.symbol)) existing.set(item.symbol, item);
        }
        const favorites = Array.from(existing.values()).sort((a, b) => b.addedAt - a.addedAt);
        set({ favorites });
        return parsed.length;
      },
    }),
    {
      name: FAVORITES_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => (typeof window === "undefined" ? noopStorage : window.localStorage)),
      partialize: (state) => ({ favorites: state.favorites }),
      merge: (persisted, current) => {
        const favorites = parseFavorites(
          (persisted as { favorites?: unknown } | undefined)?.favorites,
        );
        return { ...current, favorites };
      },
    },
  ),
);

export function parseFavorites(value: unknown): Favorite[] {
  if (!Array.isArray(value)) return [];
  const out: Favorite[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const symbol = typeof item.symbol === "string" ? item.symbol.trim() : "";
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({
      symbol,
      name: typeof item.name === "string" && item.name.trim() ? item.name : symbol,
      exchange: typeof item.exchange === "string" ? item.exchange : null,
      quoteType: QUOTE_TYPES.includes(item.quoteType as QuoteType)
        ? (item.quoteType as QuoteType)
        : "EQUITY",
      addedAt:
        typeof item.addedAt === "number" && Number.isFinite(item.addedAt) ? item.addedAt : Date.now(),
    });
  }
  return out;
}

/** Selector-friendly helpers. */
export const selectFavorites = (state: FavoritesState) => state.favorites;
export const selectSymbols = (state: FavoritesState) => state.favorites.map((item) => item.symbol);
