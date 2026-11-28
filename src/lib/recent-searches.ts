"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import {
  parseRecentSearches,
  RECENT_SEARCH_LIMIT,
  type RecentSearch,
} from "@/lib/user-state";

export type { RecentSearch };

export const RECENT_SEARCHES_STORAGE_KEY = "sg:recent-searches:v1";

interface RecentSearchesState {
  items: RecentSearch[];
  add: (item: RecentSearch) => void;
  clear: () => void;
  /** Replaces the list with state loaded from the server. */
  replaceAll: (items: RecentSearch[]) => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

/** Local cache of recent searches; the database is the source of truth. */
export const useRecentSearches = create<RecentSearchesState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        const next = [item, ...get().items.filter((entry) => entry.symbol !== item.symbol)].slice(
          0,
          RECENT_SEARCH_LIMIT,
        );
        set({ items: next });
      },
      clear: () => set({ items: [] }),
      replaceAll: (items) => set({ items }),
    }),
    {
      name: RECENT_SEARCHES_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => (typeof window === "undefined" ? noopStorage : window.localStorage)),
      partialize: (state) => ({ items: state.items }),
      // The pre-database format was a bare array under the same key.
      merge: (persisted, current) => {
        const raw = persisted as { items?: unknown } | unknown[] | undefined;
        const items = Array.isArray(raw) ? raw : (raw as { items?: unknown } | undefined)?.items;
        return { ...current, items: parseRecentSearches(items) };
      },
    },
  ),
);

export function getRecentSearches(): RecentSearch[] {
  return useRecentSearches.getState().items;
}

export function addRecentSearch(item: RecentSearch): RecentSearch[] {
  useRecentSearches.getState().add(item);
  return getRecentSearches();
}

export function clearRecentSearches(): void {
  useRecentSearches.getState().clear();
}
