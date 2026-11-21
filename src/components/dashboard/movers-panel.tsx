"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/avatar";
import { FavoriteButton } from "@/components/favorite-button";
import { UpdatedAgo } from "@/components/live-badge";
import { SectionHeader } from "@/components/section-header";
import { ChangeBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { useCurrency, useMovers, usePrefetchStock } from "@/lib/queries";
import type { Quote } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "gainers" | "losers";

const TABS = [
  { value: "gainers", label: "Gainers" },
  { value: "losers", label: "Losers" },
] as const;

export function MoversPanel() {
  const [tab, setTab] = useState<Tab>("gainers");
  const { data, isPending, isError, error, refetch } = useMovers();
  const prefetch = usePrefetchStock();
  const { format } = useCurrency();

  const rows = tab === "gainers" ? (data?.gainers ?? []) : (data?.losers ?? []);

  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <SectionHeader
        icon={tab === "gainers" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
        title="Market movers"
        description="Biggest daily swings across our global universe"
        action={<Segmented options={TABS} value={tab} onChange={setTab} size="sm" ariaLabel="Movers direction" />}
      />

      <div className="min-h-0 flex-1">
        {isPending ? (
          <div className="space-y-2 pt-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 py-1.5">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-2.5 w-1/5" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-xs text-muted">
              {error instanceof Error ? error.message : "Movers are unavailable right now."}
            </p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted">No moves to report.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((quote, index) => (
              <li key={quote.symbol}>
                <MoverRow
                  quote={quote}
                  rank={index + 1}
                  price={format(quote.price, quote.currency, quote.quoteType).text}
                  onHover={() => prefetch(quote.symbol)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <UpdatedAgo timestamp={data?.asOf ? data.asOf * 1000 : undefined} />
        <span className="text-[10px] text-muted">
          {data ? `${data.universe} stocks scanned${data.partial ? " · partial" : ""}` : "Global universe"}
        </span>
      </div>
    </Card>
  );
}

function MoverRow({
  quote,
  rank,
  price,
  onHover,
}: {
  quote: Quote;
  rank: number;
  price: string;
  onHover: () => void;
}) {
  const positive = (quote.changePercent ?? 0) >= 0;
  return (
    <div className="flex items-center gap-1" onMouseEnter={onHover}>
      <Link
        href={`/stock/${encodeURIComponent(quote.symbol)}`}
        className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-2 transition hover:bg-surface-2/50"
      >
        <span className="w-4 shrink-0 text-center font-mono text-[10px] text-muted/70">{rank}</span>
        <Avatar size="sm" symbol={quote.symbol} name={quote.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-tight">{quote.name}</p>
          <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-muted">
            {quote.symbol}
            {quote.exchange ? <span className="hidden sm:inline">· {quote.exchange}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="tnum font-mono text-xs font-medium">{price}</span>
          <span className={cn("flex items-center gap-0.5 text-[10px]", positive ? "text-up" : "text-down")}>
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            <ChangeBadge value={quote.changePercent} showArrow={false} className="bg-transparent p-0" />
          </span>
        </div>
      </Link>
      <FavoriteButton
        size="sm"
        favorite={{
          symbol: quote.symbol,
          name: quote.name,
          exchange: quote.exchange,
          quoteType: quote.quoteType,
        }}
      />
    </div>
  );
}
