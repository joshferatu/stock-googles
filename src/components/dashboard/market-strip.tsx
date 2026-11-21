"use client";

import Link from "next/link";

import { Sparkline } from "@/components/sparkline";
import { Card, Skeleton } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { useMarkets, usePrefetchStock } from "@/lib/queries";
import { MARKET_INDICES } from "@/lib/universe";
import { cn } from "@/lib/utils";

const LABELS = new Map(MARKET_INDICES.map((index) => [index.symbol, index]));

export function MarketStrip() {
  const { data, isPending, isError } = useMarkets();
  const prefetch = usePrefetchStock();

  if (isPending) {
    return (
      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[62px] min-w-[150px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || !data?.indices.length) {
    return (
      <Card className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-muted">
        <span>Market indices are unavailable right now.</span>
        <Link href="/search?q=%5EIXIC" className="font-medium text-accent hover:underline">
          Browse indices
        </Link>
      </Card>
    );
  }

  return (
    <div className="relative">
      <div className="scrollbar-none -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
      {data.indices.map((quote) => {
        const meta = LABELS.get(quote.symbol);
        const positive = (quote.changePercent ?? 0) >= 0;
        return (
          <Link
            key={quote.symbol}
            href={`/stock/${encodeURIComponent(quote.symbol)}`}
            onMouseEnter={() => prefetch(quote.symbol)}
            className="group flex min-w-[158px] snap-start items-center justify-between gap-3 rounded-xl border border-border bg-surface/60 px-3 py-2.5 backdrop-blur-sm transition hover:border-border-strong hover:bg-surface"
          >
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted">
                {meta?.label ?? quote.name}
              </p>
              <p className="tnum mt-0.5 font-mono text-[13px] font-medium">{formatNumber(quote.price, 2)}</p>
              <p className={cn("tnum font-mono text-[10px]", positive ? "text-up" : "text-down")}>
                {quote.changePercent == null
                  ? "—"
                  : `${quote.changePercent > 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`}
              </p>
            </div>
            <Sparkline
              data={quote.sparkline}
              positive={positive}
              width={44}
              height={26}
              strokeWidth={1.4}
              className="opacity-80 transition group-hover:opacity-100"
            />
          </Link>
        );
      })}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-bg to-transparent"
      />
    </div>
  );
}
