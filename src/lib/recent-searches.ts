"use client";

import type { QuoteType } from "@/lib/types";

export interface RecentSearch {
  symbol: string;
  name: string;
  exchangeName: string | null;
  quoteType: QuoteType;
}

const KEY = "sg:recent-searches:v1";
const LIMIT = 8;

export function getRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentSearch =>
          Boolean(item) &&
          typeof (item as RecentSearch).symbol === "string" &&
          typeof (item as RecentSearch).name === "string",
      )
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function addRecentSearch(item: RecentSearch): RecentSearch[] {
  const next = [item, ...getRecentSearches().filter((entry) => entry.symbol !== item.symbol)].slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: recents are a convenience.
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
