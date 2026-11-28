"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { parseFavorites, type Favorite, type FavoriteInput } from "@/lib/user-state";

export type { Favorite, FavoriteInput };
export { parseFavorites };

interface FavoritesState {
  favorites: Favorite[];
  addFavorite: (favorite: FavoriteInput) => void;
  removeFavorite: (symbol: string) => void;
  toggleFavorite: (favorite: FavoriteInput) => void;
  clearFavorites: () => void;
  importFavorites: (items: unknown) => number;
  /** Replaces the list with state loaded from the server. */
  setFavorites: (favorites: Favorite[]) => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

/**
 * Local cache of the watchlist. The database (`/api/user/state`) is the source
 * of truth; this store keeps mutations instant and the UI readable offline.
 */
export const FAVORITES_STORAGE_KEY = "sg:favorites:v1";

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
      setFavorites: (favorites) => set({ favorites }),
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

/** Selector-friendly helpers. */
export const selectFavorites = (state: FavoritesState) => state.favorites;
export const selectSymbols = (state: FavoritesState) => state.favorites.map((item) => item.symbol);
