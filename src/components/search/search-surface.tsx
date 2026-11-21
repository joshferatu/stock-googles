"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight, Clock, Search, Star, TrendingUp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Skeleton } from "@/components/ui/card";
import { useHydrated } from "@/lib/client-hooks";
import { useFavorites } from "@/lib/favorites-store";
import { useInstrumentSearch } from "@/lib/queries";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  type RecentSearch,
} from "@/lib/recent-searches";
import type { Instrument, QuoteType } from "@/lib/types";
import { POPULAR_SYMBOLS } from "@/lib/universe";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-store";

const TYPE_LABEL: Record<QuoteType, string> = {
  EQUITY: "Stock",
  ETF: "ETF",
  INDEX: "Index",
  MUTUALFUND: "Fund",
  OTHER: "Asset",
};

/** Symbols shown when the box is empty; mostly recognisable names. */
const SUGGESTIONS: Array<Pick<Instrument, "symbol" | "name" | "quoteType" | "exchangeName">> = [
  { symbol: "AAPL", name: "Apple Inc.", quoteType: "EQUITY", exchangeName: "NASDAQ" },
  { symbol: "MSFT", name: "Microsoft Corporation", quoteType: "EQUITY", exchangeName: "NASDAQ" },
  { symbol: "NVDA", name: "NVIDIA Corporation", quoteType: "EQUITY", exchangeName: "NASDAQ" },
  { symbol: "TEF.MC", name: "Telefónica, S.A.", quoteType: "EQUITY", exchangeName: "Madrid" },
  { symbol: "^IXIC", name: "Nasdaq Composite", quoteType: "INDEX", exchangeName: "NASDAQ" },
  { symbol: "^IBEX", name: "IBEX 35", quoteType: "INDEX", exchangeName: "Madrid" },
];

export function SearchSurface({
  autoFocus = false,
  onNavigate,
  className,
}: {
  autoFocus?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const favorites = useFavorites((state) => state.favorites);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecents(getRecentSearches());
    if (autoFocus) {
      const timer = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const { data, isPending, isFetching, isError, error, refetch } = useInstrumentSearch(query);
  const results = query.trim().length >= 1 ? (data?.results ?? []) : [];
  const showLoading = query.trim().length >= 1 && (isPending || (isFetching && results.length === 0));

  useEffect(() => {
    setActiveIndex(0);
  }, [data?.query, query]);

  const select = useCallback(
    (instrument: Pick<Instrument, "symbol" | "name" | "quoteType" | "exchangeName">) => {
      addRecentSearch({
        symbol: instrument.symbol,
        name: instrument.name,
        exchangeName: instrument.exchangeName ?? null,
        quoteType: instrument.quoteType,
      });
      onNavigate?.();
      router.push(`/stock/${encodeURIComponent(instrument.symbol)}`);
    },
    [onNavigate, router],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const target = results[activeIndex] ?? results[0];
      if (target) {
        event.preventDefault();
        select(target);
      }
    }
  };

  const isFavorite = (symbol: string) => hydrated && favorites.some((item) => item.symbol === symbol);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center gap-2.5 border-b border-border px-4">
        <Search className="size-4 shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search any company, ETF or index worldwide…"
          className="h-12 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted/70"
          aria-label="Search companies, ETFs and indices"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="rounded-md p-1 text-muted transition hover:bg-surface-2 hover:text-fg"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="hidden rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted sm:block">
            ESC
          </kbd>
        )}
      </div>

      <div className="max-h-[min(62vh,520px)] overflow-y-auto overscroll-contain p-2">
        {query.trim().length === 0 ? (
          <IdlePanel recents={recents} onPick={select} onClearRecents={() => setRecents([])} />
        ) : showLoading ? (
          <div className="space-y-1 p-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-xl p-2.5">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-2.5 w-1/4" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title="Search is unavailable"
            description={error instanceof Error ? error.message : "Please try again."}
            action={
              <button
                type="button"
                onClick={() => void refetch()}
                className="text-xs font-medium text-accent hover:underline"
              >
                Retry
              </button>
            }
            className="m-2 border-0 bg-transparent"
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title={`No matches for “${query.trim()}”`}
            description="Try a ticker (AAPL), a company name (Telefónica) or an index (Nasdaq)."
            className="m-2 border-0 bg-transparent"
          />
        ) : (
          <div role="listbox" aria-label="Search results" className="space-y-0.5">
            {results.map((instrument, index) => (
              <ResultRow
                key={instrument.symbol}
                instrument={instrument}
                active={index === activeIndex}
                favorite={isFavorite(instrument.symbol)}
                onHover={() => setActiveIndex(index)}
                onSelect={() => select(instrument)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted">
        <span className="hidden sm:inline">↑ ↓ to navigate · ↵ to open</span>
        <span className="sm:hidden">Tap a result to open</span>
        <span>Market data by Yahoo Finance</span>
      </div>
    </div>
  );
}

function ResultRow({
  instrument,
  active,
  favorite,
  onHover,
  onSelect,
}: {
  instrument: Instrument;
  active: boolean;
  favorite: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      onMouseEnter={onHover}
      className={cn(
        "group flex items-center gap-1 rounded-xl transition-colors",
        active ? "bg-surface-2" : "hover:bg-surface-2/60",
      )}
    >
      <button
        type="button"
        role="option"
        aria-selected={active}
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2.5 text-left"
      >
        <Avatar size="sm" symbol={instrument.symbol} name={instrument.name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{instrument.name}</span>
            <Badge tone="outline" className="hidden shrink-0 sm:inline-flex">
              {TYPE_LABEL[instrument.quoteType]}
            </Badge>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
            <span className="font-mono">{instrument.symbol}</span>
            {instrument.exchangeName ? <span>· {instrument.exchangeName}</span> : null}
            {instrument.sector ? <span className="hidden sm:inline">· {instrument.sector}</span> : null}
          </span>
        </span>
        <ArrowUpRight
          className={cn(
            "hidden size-4 shrink-0 text-muted transition sm:block",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        />
      </button>
      <StarToggle
        favorite={favorite}
        instrument={instrument}
      />
    </div>
  );
}

function StarToggle({
  favorite,
  instrument,
}: {
  favorite: boolean;
  instrument: Instrument;
}) {
  const toggleFavorite = useFavorites((state) => state.toggleFavorite);
  return (
    <button
      type="button"
      aria-label={favorite ? `Remove ${instrument.symbol} from favourites` : `Add ${instrument.symbol} to favourites`}
      aria-pressed={favorite}
      onClick={(event) => {
        event.stopPropagation();
        toggleFavorite({
          symbol: instrument.symbol,
          name: instrument.name,
          exchange: instrument.exchangeName,
          quoteType: instrument.quoteType,
        });
        toast(
          favorite ? `${instrument.symbol} removed` : `${instrument.symbol} added to favourites`,
          favorite ? "default" : "success",
        );
      }}
      className={cn(
        "mr-1.5 rounded-lg p-2 transition active:scale-90",
        favorite ? "text-accent" : "text-muted/60 hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Star className={cn("size-4", favorite && "fill-current")} />
    </button>
  );
}

function IdlePanel({
  recents,
  onPick,
  onClearRecents,
}: {
  recents: RecentSearch[];
  onPick: (item: RecentSearch) => void;
  onClearRecents: () => void;
}) {
  const suggestions = useMemo(() => {
    const seen = new Set(POPULAR_SYMBOLS);
    return SUGGESTIONS.filter((item) => seen.has(item.symbol));
  }, []);

  return (
    <div className="space-y-4 p-2">
      {recents.length > 0 ? (
        <section>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Recent</span>
            <button
              type="button"
              onClick={() => {
                clearRecentSearches();
                onClearRecents();
              }}
              className="text-[10px] text-muted transition hover:text-fg"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recents.map((recent) => (
              <button
                key={recent.symbol}
                type="button"
                onClick={() => onPick(recent)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/60 px-2 py-1.5 text-xs transition hover:border-border-strong hover:bg-surface-2"
              >
                <Clock className="size-3 text-muted" />
                <span className="font-mono text-[11px]">{recent.symbol}</span>
                <span className="max-w-[120px] truncate text-muted">{recent.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-1.5 flex items-center gap-1.5 px-1">
          <TrendingUp className="size-3 text-accent" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Popular right now</span>
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.symbol}
              type="button"
              onClick={() => onPick({ ...suggestion, exchangeName: suggestion.exchangeName ?? null })}
              className="flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left transition hover:border-border hover:bg-surface-2/60"
            >
              <Avatar size="sm" symbol={suggestion.symbol} name={suggestion.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{suggestion.name}</span>
                <span className="block font-mono text-[10px] text-muted">
                  {suggestion.symbol} · {suggestion.exchangeName}
                </span>
              </span>
              <ArrowUpRight className="size-3.5 text-muted" />
            </button>
          ))}
        </div>
      </section>

      <p className="px-1 text-[10px] leading-relaxed text-muted/80">
        Tip: press <kbd className="rounded border border-border bg-surface-2 px-1 font-mono">⌘K</kbd> anywhere to open
        search, or star a company to add it to your watchlist.
      </p>
    </div>
  );
}
