"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { apiGet } from "@/lib/api-client";
import { useDebouncedValue } from "@/lib/client-hooks";
import { convertAmount, ratesFor, type DisplayCurrency } from "@/lib/fx";
import { RANGES, type RangeId } from "@/lib/ranges";
import { useSettings } from "@/lib/settings-store";
import type {
  ChartPayload,
  FxPayload,
  Instrument,
  MarketsPayload,
  MoversPayload,
  NewsItem,
  Quote,
  QuoteType,
} from "@/lib/types";
import type { UserStateResponse } from "@/lib/user-state";
import { formatPrice } from "@/lib/format";

interface QuotesResponse {
  quotes: Quote[];
  fetchedAt: number;
}

interface NewsResponse {
  items: NewsItem[];
  symbols: string[];
  fetchedAt: number;
}

interface SearchResponse {
  query: string;
  results: Instrument[];
  fetchedAt: number;
}

interface SessionResponse {
  required: boolean;
  authenticated: boolean;
  email: string | null;
  name: string | null;
  mode: "open" | "google" | "mock";
  sso: boolean;
}

export const queryKeys = {
  quotes: (key: string) => ["quotes", key] as const,
  quote: (symbol: string) => ["quote", symbol] as const,
  chart: (symbol: string, range: RangeId) => ["chart", symbol, range] as const,
  news: (symbolsKey: string, market: boolean) => ["news", symbolsKey, market] as const,
  movers: ["movers"] as const,
  markets: ["markets"] as const,
  fx: ["fx"] as const,
  search: (query: string) => ["search", query] as const,
  profile: (symbol: string) => ["profile", symbol] as const,
  session: ["session"] as const,
  userState: ["user-state"] as const,
};

export async function fetchQuotesFor(symbols: string[], signal?: AbortSignal): Promise<QuotesResponse> {
  return apiGet<QuotesResponse>(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`, signal);
}

/** Batch quote query: one upstream call for the whole watchlist. */
export function useQuotes(symbols: readonly string[]) {
  const queryClient = useQueryClient();
  const key = useMemo(() => Array.from(new Set(symbols)).sort().join(","), [symbols]);

  return useQuery({
    queryKey: queryKeys.quotes(key),
    queryFn: async ({ signal }) => {
      const data = await fetchQuotesFor(key.split(","), signal);
      // Write-through per-symbol entries so detail pages and hover prefetches reuse them.
      for (const quote of data.quotes) queryClient.setQueryData(queryKeys.quote(quote.symbol), quote);
      return data;
    },
    enabled: key.length > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });
}

export function useQuote(symbol: string) {
  return useQuery({
    queryKey: queryKeys.quote(symbol),
    queryFn: async ({ signal }) => {
      const data = await fetchQuotesFor([symbol], signal);
      return data.quotes[0] ?? null;
    },
    enabled: Boolean(symbol),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useChart(symbol: string, range: RangeId) {
  return useQuery({
    queryKey: queryKeys.chart(symbol, range),
    queryFn: ({ signal }) =>
      apiGet<ChartPayload>(
        `/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`,
        signal,
      ),
    enabled: Boolean(symbol),
    staleTime: RANGES[range].ttl * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useNews(symbols: readonly string[], includeMarket = true, limit = 24) {
  const key = useMemo(() => Array.from(new Set(symbols)).sort().join(","), [symbols]);
  return useQuery({
    queryKey: queryKeys.news(key, includeMarket),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (key) params.set("symbols", key);
      if (includeMarket) params.set("market", "1");
      params.set("limit", String(limit));
      return apiGet<NewsResponse>(`/api/news?${params.toString()}`, signal);
    },
    enabled: includeMarket || key.length > 0,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useMovers() {
  return useQuery({
    queryKey: queryKeys.movers,
    queryFn: ({ signal }) => apiGet<MoversPayload>("/api/movers", signal),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useMarkets() {
  return useQuery({
    queryKey: queryKeys.markets,
    queryFn: ({ signal }) => apiGet<MarketsPayload>("/api/markets", signal),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useFx() {
  return useQuery({
    queryKey: queryKeys.fx,
    queryFn: ({ signal }) => apiGet<FxPayload>("/api/fx", signal),
    staleTime: 6 * 60 * 60_000,
  });
}

export function useInstrumentSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), 250);
  return useQuery({
    queryKey: queryKeys.search(debounced.toLowerCase()),
    queryFn: ({ signal }) =>
      apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(debounced)}`, signal),
    enabled: debounced.length >= 1,
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useProfile(symbol: string) {
  return useQuery({
    queryKey: queryKeys.profile(symbol),
    queryFn: async ({ signal }) => {
      const data = await apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(symbol)}`, signal);
      return data.results.find((result) => result.symbol === symbol) ?? null;
    },
    enabled: Boolean(symbol),
    staleTime: 24 * 60 * 60_000,
  });
}

export function useSessionInfo() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: ({ signal }) => apiGet<SessionResponse>("/api/auth/session", signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * The signed-in user's favourite/preferences document.
 *
 * Never revalidated on its own: the sync layer (`user-state-sync.tsx`) owns
 * writes and keeps the Zustand stores in step, so a background refetch would
 * only fight with the optimistic local state.
 */
export function useUserState() {
  return useQuery({
    queryKey: queryKeys.userState,
    queryFn: ({ signal }) => apiGet<UserStateResponse>("/api/user/state", signal),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
}

export interface CurrencyFormatter {
  displayCurrency: DisplayCurrency;
  target: string | null;
  format: (
    value: number | null | undefined,
    from: string | null | undefined,
    kind?: QuoteType,
  ) => { text: string; converted: boolean; native: string | null };
}

export function useCurrency(): CurrencyFormatter {
  const displayCurrency = useSettings((state) => state.displayCurrency);
  const { data: fx } = useFx();
  const rates = useMemo(() => ratesFor(fx), [fx]);

  const target = displayCurrency === "native" ? null : displayCurrency;

  const format = useCallback<CurrencyFormatter["format"]>(
    (value, from, kind) => {
      if (value == null || !Number.isFinite(value)) {
        return { text: "—", converted: false, native: null };
      }
      const native = formatPrice(value, from);
      const shouldConvert = Boolean(target) && kind !== "INDEX" && from && target !== from;
      if (shouldConvert) {
        const converted = convertAmount(value, from, target, rates);
        if (converted != null) {
          return {
            text: formatPrice(converted, target),
            converted: true,
            native,
          };
        }
      }
      return { text: native, converted: false, native: null };
    },
    [target, rates],
  );

  return { displayCurrency, target, format };
}

/** Warm the cache on hover so opening a stock feels instant. */
export function usePrefetchStock() {
  const queryClient = useQueryClient();
  return useCallback(
    (symbol: string) => {
      if (!symbol) return;
      void queryClient.prefetchQuery({
        queryKey: queryKeys.quote(symbol),
        queryFn: async ({ signal }) => {
          const data = await fetchQuotesFor([symbol], signal);
          return data.quotes[0] ?? null;
        },
        staleTime: 30_000,
      });
      void queryClient.prefetchQuery({
        queryKey: queryKeys.chart(symbol, "1M"),
        queryFn: ({ signal }) =>
          apiGet<ChartPayload>(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=1M`, signal),
        staleTime: RANGES["1M"].ttl * 1000,
      });
    },
    [queryClient],
  );
}
