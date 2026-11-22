"use client";

import { ExternalLink, Newspaper } from "lucide-react";
import { useMemo, useState } from "react";

import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState, Skeleton } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { useHydrated } from "@/lib/client-hooks";
import { useFavorites } from "@/lib/favorites-store";
import { formatRelativeTime } from "@/lib/format";
import { useNews } from "@/lib/queries";
import type { NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "for-you" | "market";

const TABS = [
  { value: "for-you", label: "For you" },
  { value: "market", label: "Market" },
] as const;

export function NewsFeed({
  title = "Market news",
  symbols,
  limit = 7,
  tabs = true,
  className,
}: {
  title?: string;
  symbols?: string[];
  limit?: number;
  tabs?: boolean;
  className?: string;
}) {
  const hydrated = useHydrated();
  const favorites = useFavorites((state) => state.favorites);
  const favoriteSymbols = useMemo(
    () => (symbols ?? favorites.map((favorite) => favorite.symbol)).slice(0, 8),
    [symbols, favorites],
  );
  const [tab, setTab] = useState<Tab>("for-you");

  const { data, isPending, isError } = useNews(favoriteSymbols, true, 30);

  const favoriteSet = useMemo(() => new Set(favoriteSymbols), [favoriteSymbols]);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (tabs && tab === "market") return all;
    // "For you" and detail pages prefer tagged headlines, falling back to all
    // so the section never becomes an empty box.
    const relevant = all.filter((item) => item.tickers.some((ticker) => favoriteSet.has(ticker)));
    return relevant.length > 0 ? relevant : all;
  }, [data, favoriteSet, tab, tabs]);

  const visible = items.slice(0, limit);
  const showForYouEmpty =
    tabs && tab === "for-you" && favoriteSymbols.length > 0 && !isPending && items.length === 0;

  return (
    <Card className={cn("flex flex-col p-4 sm:p-5", className)}>
      <SectionHeader
        icon={<Newspaper className="size-4" />}
        title={title}
        description={
          tabs && hydrated
            ? favoriteSymbols.length > 0
              ? "Headlines for your watchlist and the wider market"
              : "Star companies to get personalised headlines"
            : "Latest headlines from the market"
        }
        action={
          tabs ? (
            <Segmented options={TABS} value={tab} onChange={setTab} size="sm" ariaLabel="News filter" />
          ) : null
        }
      />

      <div className="min-h-0 flex-1">
        {isPending && !data ? (
          <div className="space-y-3 pt-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-1.5">
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-xs text-muted">News is unavailable right now.</p>
        ) : showForYouEmpty ? (
          <EmptyState
            title="No headlines for your favourites yet"
            description="Try the market tab, or come back later."
            className="border-0 bg-transparent"
          />
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted">No headlines right now.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {visible.map((item) => (
              <li key={item.id}>
                <NewsRow item={item} favorites={favoriteSet} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {data?.items?.length ? (
        <p className="mt-2 border-t border-border/60 pt-2 text-[10px] text-muted">
          Headlines by Yahoo Finance · tap to read at the source
        </p>
      ) : null}
    </Card>
  );
}

function NewsRow({ item, favorites }: { item: NewsItem; favorites: Set<string> }) {
  const tickers = item.tickers.filter((ticker) => ticker.length <= 12).slice(0, 3);
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg px-1 py-2.5 transition hover:bg-surface-2/40"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
          <Newspaper className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-medium leading-snug transition group-hover:text-accent">
            {item.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-muted">
            <span className="truncate">{item.publisher}</span>
            <span>·</span>
            <span>{formatRelativeTime(item.publishedAt)}</span>
            {tickers.map((ticker) => (
              <Badge
                key={ticker}
                tone={favorites.has(ticker) ? "accent" : "outline"}
                className="px-1 py-0 text-[9px]"
              >
                {ticker}
              </Badge>
            ))}
          </div>
        </div>
        <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted opacity-0 transition group-hover:opacity-70" />
      </div>
    </a>
  );
}
