"use client";

import Link from "next/link";
import { ArrowRight, Plus, Star } from "lucide-react";
import { useMemo } from "react";

import { Avatar } from "@/components/avatar";
import { FavoriteButton } from "@/components/favorite-button";
import { UpdatedAgo } from "@/components/live-badge";
import { SectionHeader } from "@/components/section-header";
import { Sparkline } from "@/components/sparkline";
import { ChangeBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Skeleton } from "@/components/ui/card";
import { useHydrated } from "@/lib/client-hooks";
import { useFavorites, type Favorite } from "@/lib/favorites-store";
import { formatPercent } from "@/lib/format";
import { useCurrency, usePrefetchStock, useQuotes } from "@/lib/queries";
import type { Quote } from "@/lib/types";
import { cn } from "@/lib/utils";

const DASHBOARD_LIMIT = 6;

const SUGGESTED: Array<Omit<Favorite, "addedAt">> = [
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", quoteType: "EQUITY" },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", quoteType: "EQUITY" },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", quoteType: "EQUITY" },
  { symbol: "TEF.MC", name: "Telefónica, S.A.", exchange: "Madrid", quoteType: "EQUITY" },
];

export function FavoritesSummary() {
  const hydrated = useHydrated();
  const favorites = useFavorites((state) => state.favorites);
  const symbols = useMemo(() => favorites.map((favorite) => favorite.symbol), [favorites]);
  const query = useQuotes(symbols);
  const prefetch = usePrefetchStock();

  const quotesBySymbol = useMemo(() => {
    const map = new Map<string, Quote>();
    for (const quote of query.data?.quotes ?? []) map.set(quote.symbol, quote);
    return map;
  }, [query.data]);

  const aggregate = useMemo(() => {
    const values = (query.data?.quotes ?? [])
      .map((quote) => quote.changePercent)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (values.length === 0) return null;
    return {
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      up: values.filter((value) => value > 0).length,
      down: values.filter((value) => value < 0).length,
      total: values.length,
    };
  }, [query.data]);

  const visible = favorites.slice(0, DASHBOARD_LIMIT);

  return (
    <section aria-labelledby="watchlist-heading">
      <SectionHeader
        icon={<Star className="size-4" />}
        title="Your watchlist"
        description={
          !hydrated
            ? "Loading your favourites…"
            : favorites.length === 0
              ? "Star companies to follow them here."
              : `${favorites.length} ${favorites.length === 1 ? "company" : "companies"}${
                  aggregate
                    ? ` · average ${formatPercent(aggregate.average)} today · ${aggregate.up} up, ${aggregate.down} down`
                    : ""
                }`
        }
        action={
          favorites.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex">
                <UpdatedAgo timestamp={query.data?.fetchedAt} />
              </span>
              <Link
                href="/favorites"
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted transition hover:border-border-strong hover:text-fg"
              >
                Manage
                <ArrowRight className="size-3" />
              </Link>
            </div>
          ) : (
            <Link href="/search">
              <Button size="sm" variant="primary">
                <Plus className="size-3.5" />
                Add
              </Button>
            </Link>
          )
        }
      />

      {!hydrated ? (
        <WatchlistSkeleton />
      ) : favorites.length === 0 ? (
        <EmptyWatchlist />
      ) : (
        <>
          {query.isError ? (
            <Card className="mb-3 flex items-center justify-between gap-3 px-4 py-2.5 text-xs text-muted">
              <span>Live prices are unavailable. Showing your saved companies.</span>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="font-medium text-accent hover:underline"
              >
                Retry
              </button>
            </Card>
          ) : null}
          <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((favorite) => (
              <FavoriteCard
                key={favorite.symbol}
                favorite={favorite}
                quote={quotesBySymbol.get(favorite.symbol)}
                loading={query.isPending}
                onHover={() => prefetch(favorite.symbol)}
              />
            ))}
          </div>
          {favorites.length > DASHBOARD_LIMIT ? (
            <div className="mt-3 text-center">
              <Link
                href="/favorites"
                className="text-xs font-medium text-accent transition hover:underline"
              >
                View all {favorites.length} favourites
              </Link>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function FavoriteCard({
  favorite,
  quote,
  loading,
  onHover,
}: {
  favorite: Favorite;
  quote: Quote | undefined;
  loading: boolean;
  onHover: () => void;
}) {
  const { format } = useCurrency();
  const price = format(quote?.price, quote?.currency, quote?.quoteType);
  const positive = (quote?.changePercent ?? 0) >= 0;

  return (
    <div
      onMouseEnter={onHover}
      className="group relative overflow-hidden rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface hover:shadow-[0_18px_40px_-30px_rgba(0,0,0,0.9)]"
    >
      <Link
        href={`/stock/${encodeURIComponent(favorite.symbol)}`}
        className="absolute inset-0 z-0"
        aria-label={`Open ${favorite.name}`}
      />
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar size="sm" symbol={favorite.symbol} name={quote?.name ?? favorite.name} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium leading-tight">{quote?.name ?? favorite.name}</p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
              {favorite.symbol}
              {quote?.exchange ? ` · ${quote.exchange}` : favorite.exchange ? ` · ${favorite.exchange}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none relative z-10 mt-3 flex items-end justify-between gap-2">
        <div>
          {loading && !quote ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <p className="tnum font-mono text-xl font-semibold tracking-tight">{price.text}</p>
          )}
          {price.converted && price.native ? (
            <p className="mt-0.5 text-[10px] text-muted">{price.native}</p>
          ) : null}
        </div>
        <ChangeBadge value={quote?.changePercent} />
      </div>

      <div className="pointer-events-none relative z-10 mt-2 flex items-end justify-between gap-2">
        {quote ? (
          <Sparkline data={quote.sparkline} positive={positive} width={110} height={26} />
        ) : (
          <div className="h-[26px]" />
        )}
        <span className={cn("text-[10px]", quote?.marketState === "OPEN" ? "text-up" : "text-muted")}>
          {quote?.marketState === "OPEN" ? "Open" : quote?.marketState === "CLOSED" ? "Closed" : "—"}
        </span>
      </div>

      <div className="pointer-events-auto absolute right-2.5 top-2.5 z-20">
        <FavoriteButton favorite={favorite} size="sm" />
      </div>
    </div>
  );
}

function EmptyWatchlist() {
  const toggleFavorite = useFavorites((state) => state.toggleFavorite);
  return (
    <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-accent/[0.07] via-surface/70 to-surface/60 p-6">
      <div className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative">
        <p className="text-sm font-semibold">Build your own watchlist</p>
        <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted">
          Star a company from search or its detail page. Your favourites are saved in this browser and shown first
          on this dashboard, with news picked for them.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {SUGGESTED.map((suggestion) => (
            <button
              key={suggestion.symbol}
              type="button"
              onClick={() => toggleFavorite(suggestion)}
              className="group flex items-center gap-2 rounded-xl border border-border bg-surface/80 px-2.5 py-2 text-left transition hover:border-accent/40 hover:bg-surface"
            >
              <Star className="size-3.5 text-muted transition group-hover:text-accent" />
              <span className="text-xs font-medium">{suggestion.symbol}</span>
              <span className="hidden max-w-[110px] truncate text-[10px] text-muted sm:inline">{suggestion.name}</span>
            </button>
          ))}
          <Link href="/search">
            <Button size="sm" variant="primary">
              Search the market
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function WatchlistSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="p-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
          </div>
          <Skeleton className="mt-4 h-6 w-24" />
          <Skeleton className="mt-3 h-6 w-full" />
        </Card>
      ))}
    </div>
  );
}

export function NoFavoritesNote() {
  return (
    <EmptyState
      icon={<Star className="size-5" />}
      title="No favourites yet"
      description="Star a company to see it here."
      className="border-0 bg-transparent"
    />
  );
}
