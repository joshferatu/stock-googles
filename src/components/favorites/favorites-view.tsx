"use client";

import { Download, RefreshCw, Star, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/avatar";
import { EmptyFavoritesHint, FavoriteButton } from "@/components/favorite-button";
import { UpdatedAgo } from "@/components/live-badge";
import { PageHeading } from "@/components/section-header";
import { Sparkline } from "@/components/sparkline";
import { ChangeBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Skeleton } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { useHydrated } from "@/lib/client-hooks";
import { useFavorites } from "@/lib/favorites-store";
import { exportFavoritesFile, importFavoritesFile } from "@/lib/favorites-io";
import { formatRelativeTime } from "@/lib/format";
import { useCurrency, usePrefetchStock, useQuotes } from "@/lib/queries";
import type { Quote } from "@/lib/types";
import { toast } from "@/lib/toast-store";

type Sort = "added" | "change" | "name";

const SORTS = [
  { value: "added", label: "Added" },
  { value: "change", label: "Today" },
  { value: "name", label: "A–Z" },
] as const;

export function FavoritesView() {
  const hydrated = useHydrated();
  const favorites = useFavorites((state) => state.favorites);
  const clearFavorites = useFavorites((state) => state.clearFavorites);
  const [sort, setSort] = useState<Sort>("added");
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prefetch = usePrefetchStock();

  const symbols = useMemo(() => favorites.map((favorite) => favorite.symbol), [favorites]);
  const { data, isPending, isFetching, isError, refetch } = useQuotes(symbols);

  const quotesBySymbol = useMemo(() => {
    const map = new Map<string, Quote>();
    for (const quote of data?.quotes ?? []) map.set(quote.symbol, quote);
    return map;
  }, [data]);

  const sorted = useMemo(() => {
    const list = [...favorites];
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "change") {
      const value = (symbol: string) => quotesBySymbol.get(symbol)?.changePercent ?? -Infinity;
      list.sort((a, b) => value(b.symbol) - value(a.symbol));
    } else list.sort((a, b) => b.addedAt - a.addedAt);
    return list;
  }, [favorites, quotesBySymbol, sort]);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const count = await importFavoritesFile(file);
      toast(`${count} ${count === 1 ? "favourite" : "favourites"} imported`, "success");
      void refetch();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Import failed", "error");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeading
        eyebrow="Watchlist"
        title="Your favourites"
        description={
          hydrated
            ? `${favorites.length} ${favorites.length === 1 ? "company" : "companies"} saved in this browser`
            : "Loading saved favourites…"
        }
        action={
          <>
            {favorites.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void refetch()}
                aria-label="Refresh quotes"
              >
                <RefreshCw className={isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            ) : null}
            <Link href="/search">
              <Button size="sm" variant="primary">
                <Star className="size-3.5" />
                Add companies
              </Button>
            </Link>
          </>
        }
      />

      {!hydrated ? (
        <FavoritesSkeleton />
      ) : favorites.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<Star className="size-6" />}
            title="Your watchlist is empty"
            description="Search for a company and tap the star, or use the suggestions on the dashboard. Everything is stored locally in this browser."
            action={<EmptyFavoritesHint />}
            className="border-0 bg-transparent"
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted">Sort</span>
              <Segmented options={SORTS} value={sort} onChange={setSort} size="sm" ariaLabel="Sort favourites" />
            </div>
            <div className="flex items-center gap-2">
              <UpdatedAgo timestamp={data?.fetchedAt} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const count = exportFavoritesFile();
                  toast(`${count} ${count === 1 ? "favourite" : "favourites"} exported`, "success");
                }}
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button size="sm" variant="outline" loading={importing} onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-3.5" />
                <span className="hidden sm:inline">Import</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void onImport(event.target.files?.[0])}
              />
              {confirmClear ? (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="danger" onClick={() => { clearFavorites(); setConfirmClear(false); toast("Watchlist cleared"); }}>
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)} aria-label="Clear all favourites">
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          {isError ? (
            <Card className="flex items-center justify-between px-4 py-3 text-xs text-muted">
              <span>Live prices could not be loaded.</span>
              <button type="button" onClick={() => void refetch()} className="font-medium text-accent hover:underline">
                Retry
              </button>
            </Card>
          ) : null}

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface/60 md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium">Today</th>
                  <th className="px-4 py-3 font-medium">Intraday</th>
                  <th className="px-4 py-3 text-right font-medium">Added</th>
                  <th className="px-4 py-3 text-right font-medium">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sorted.map((favorite) => {
                  const quote = quotesBySymbol.get(favorite.symbol);
                  return (
                    <FavoriteRow
                      key={favorite.symbol}
                      favorite={favorite}
                      quote={quote}
                      loading={isPending}
                      onHover={() => prefetch(favorite.symbol)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {sorted.map((favorite) => {
              const quote = quotesBySymbol.get(favorite.symbol);
              return (
                <FavoriteMobileCard
                  key={favorite.symbol}
                  favorite={favorite}
                  quote={quote}
                  loading={isPending}
                  onHover={() => prefetch(favorite.symbol)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function FavoriteRow({
  favorite,
  quote,
  loading,
  onHover,
}: {
  favorite: { symbol: string; name: string; exchange: string | null; addedAt: number; quoteType: Quote["quoteType"] };
  quote: Quote | undefined;
  loading: boolean;
  onHover: () => void;
}) {
  const { format } = useCurrency();
  const price = format(quote?.price, quote?.currency, quote?.quoteType);
  return (
    <tr className="group transition hover:bg-surface-2/40" onMouseEnter={onHover}>
      <td className="px-4 py-3">
        <Link href={`/stock/${encodeURIComponent(favorite.symbol)}`} className="flex items-center gap-3">
          <Avatar size="sm" symbol={favorite.symbol} name={quote?.name ?? favorite.name} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium group-hover:text-accent">{quote?.name ?? favorite.name}</span>
            <span className="block font-mono text-[10px] text-muted">
              {favorite.symbol}
              {quote?.exchange ? ` · ${quote.exchange}` : favorite.exchange ? ` · ${favorite.exchange}` : ""}
            </span>
          </span>
        </Link>
      </td>
      <td className="tnum px-4 py-3 text-right font-mono text-[13px]">
        {loading && !quote ? <Skeleton className="ml-auto h-3.5 w-16" /> : price.text}
        {price.converted && price.native ? (
          <span className="block text-[10px] text-muted">{price.native}</span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-right">
        <ChangeBadge value={quote?.changePercent} />
      </td>
      <td className="px-4 py-3">
        {quote ? (
          <Sparkline data={quote.sparkline} positive={(quote.changePercent ?? 0) >= 0} width={90} height={24} />
        ) : (
          <span className="text-[10px] text-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-[11px] text-muted">{formatRelativeTime(favorite.addedAt / 1000)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <FavoriteButton favorite={favorite} size="sm" />
        </div>
      </td>
    </tr>
  );
}

function FavoriteMobileCard({
  favorite,
  quote,
  loading,
  onHover,
}: {
  favorite: { symbol: string; name: string; exchange: string | null; quoteType: Quote["quoteType"] };
  quote: Quote | undefined;
  loading: boolean;
  onHover: () => void;
}) {
  const { format } = useCurrency();
  const price = format(quote?.price, quote?.currency, quote?.quoteType);
  return (
    <Card className="flex items-center gap-3 p-3" onMouseEnter={onHover}>
      <Link href={`/stock/${encodeURIComponent(favorite.symbol)}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar size="sm" symbol={favorite.symbol} name={quote?.name ?? favorite.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{quote?.name ?? favorite.name}</p>
          <p className="font-mono text-[10px] text-muted">{favorite.symbol}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tnum font-mono text-[13px] font-medium">{loading && !quote ? "…" : price.text}</p>
          <ChangeBadge value={quote?.changePercent} showArrow={false} />
        </div>
      </Link>
      <FavoriteButton favorite={favorite} size="sm" />
    </Card>
  );
}

function FavoritesSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="flex items-center gap-3 p-4">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/6" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </Card>
      ))}
    </div>
  );
}
