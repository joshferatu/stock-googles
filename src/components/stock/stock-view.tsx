"use client";

import { ChevronLeft, LineChart, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/avatar";
import { NewsFeed } from "@/components/dashboard/news-feed";
import { FavoriteButton } from "@/components/favorite-button";
import { UpdatedAgo } from "@/components/live-badge";
import { SectionHeader } from "@/components/section-header";
import { PriceChart } from "@/components/stock/price-chart";
import { ChangeBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import {
  formatCompact,
  formatFullDate,
  formatPercent,
  formatPrice,
  formatRangePosition,
  formatSignedPrice,
  marketStateLabel,
} from "@/lib/format";
import { RANGES, DEFAULT_RANGE, RANGE_IDS, type RangeId } from "@/lib/ranges";
import { useChart, useCurrency, useProfile, useQuote } from "@/lib/queries";
import type { Quote } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = RANGE_IDS.map((id) => ({ value: id, label: RANGES[id].label }));

const PERIOD_LABEL: Record<RangeId, string> = {
  "1D": "today",
  "1W": "past week",
  "1M": "past month",
  "6M": "past 6 months",
  "1Y": "past year",
  "5Y": "past 5 years",
  MAX: "all time",
};

export function StockView({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<RangeId>(DEFAULT_RANGE);
  const quoteQuery = useQuote(symbol);
  const chartQuery = useChart(symbol, range);
  const profileQuery = useProfile(symbol);
  const quote = quoteQuery.data ?? null;
  const chart = chartQuery.data ?? null;
  const profile = profileQuery.data ?? null;

  useEffect(() => {
    document.title = quote ? `${quote.name} (${quote.symbol}) · Stock Googles` : `${symbol} · Stock Googles`;
  }, [quote, symbol]);

  if (quoteQuery.isPending && !quote) {
    return <StockSkeleton />;
  }

  if (!quote) {
    return (
      <div className="animate-fade-up mx-auto max-w-lg py-10">
        <Card className="p-6 text-center">
          <LineChart className="mx-auto size-7 text-muted" />
          <h1 className="mt-3 text-lg font-semibold">Could not load {symbol}</h1>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            {quoteQuery.error instanceof Error
              ? quoteQuery.error.message
              : "The symbol may be delisted, or the market data provider is temporarily unavailable."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void quoteQuery.refetch()}>
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
            <Link href="/search">
              <Button size="sm" variant="primary">
                <Search className="size-3.5" />
                Search markets
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const positive = (quote.changePercent ?? 0) >= 0;
  const performance = chart?.performance ?? null;
  const performancePositive = (performance ?? 0) >= 0;

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <Link href="/" className="inline-flex items-center gap-0.5 transition hover:text-fg">
          <ChevronLeft className="size-3.5" />
          Dashboard
        </Link>
        <span className="text-muted/50">/</span>
        <span className="font-mono">{quote.symbol}</span>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
          <Avatar size="xl" symbol={quote.symbol} name={quote.name} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{quote.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
              <span className="font-mono text-fg/80">{quote.symbol}</span>
              {quote.exchangeName || quote.exchange ? <span>· {quote.exchangeName ?? quote.exchange}</span> : null}
              <Badge tone="outline">{quote.quoteType === "INDEX" ? "Index" : quote.quoteType === "ETF" ? "ETF" : "Stock"}</Badge>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                  quote.marketState === "OPEN" ? "bg-up/12 text-up" : "bg-surface-2 text-muted",
                )}
              >
                <span
                  className={cn("size-1.5 rounded-full", quote.marketState === "OPEN" ? "bg-up live-dot" : "bg-muted/60")}
                />
                {marketStateLabel(quote.marketState)}
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="tnum font-mono text-3xl font-semibold tracking-tight">
                {formatPrice(quote.price, quote.currency)}
              </span>
              <ChangeBadge value={quote.changePercent} className="px-2 py-1 text-[13px]" />
              <span className={cn("tnum font-mono text-xs", positive ? "text-up" : "text-down")}>
                {formatSignedPrice(quote.change, quote.currency)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted">
              {quote.asOf ? (
                <span>
                  As of {formatFullDate(quote.asOf, quote.timezone)}
                  {quote.timezone ? ` · ${quote.timezone.replace(/_/g, " ")}` : ""}
                </span>
              ) : null}
              <UpdatedAgo timestamp={quoteQuery.dataUpdatedAt} prefix="Fetched" />
            </div>
            <ConvertedHint quote={quote} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <FavoriteButton
            favorite={{
              symbol: quote.symbol,
              name: quote.name,
              exchange: quote.exchange,
              quoteType: quote.quoteType,
            }}
            size="lg"
            withLabel
          />
        </div>
      </header>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
              Performance · {PERIOD_LABEL[range]}
            </p>
            <p
              className={cn(
                "tnum mt-0.5 font-mono text-lg font-semibold",
                performance == null ? "text-muted" : performancePositive ? "text-up" : "text-down",
              )}
            >
              {performance == null ? "—" : formatPercent(performance * 100)}
            </p>
          </div>
          <Segmented
            options={RANGE_OPTIONS}
            value={range}
            onChange={setRange}
            size="sm"
            ariaLabel="Chart time range"
            className="flex-wrap"
          />
        </div>

        <div className="mt-2 px-1 sm:px-2">
          {chartQuery.isError && !chart ? (
            <div className="flex h-[300px] flex-col items-center justify-center gap-3 px-6 text-center">
              <LineChart className="size-6 text-muted" />
              <div>
                <p className="text-xs font-medium">Chart unavailable</p>
                <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-muted">
                  {chartQuery.error instanceof Error
                    ? chartQuery.error.message
                    : "The market data provider did not return history for this symbol."}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void chartQuery.refetch()}>
                <RefreshCw className="size-3.5" />
                Try again
              </Button>
            </div>
          ) : (
            <PriceChart
              payload={chart}
              currency={quote.currency}
              loading={chartQuery.isFetching}
              height={300}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 text-[10px] text-muted sm:px-5">
          <span>
            {chartQuery.isFetching
              ? "Updating chart…"
              : chart
                ? `Source: Yahoo Finance · ${chart.exchangeName ?? quote.exchangeName ?? ""}`
                : "Chart unavailable"}
          </span>
          <span>Times shown in exchange local time</span>
        </div>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <SectionHeader title="Key statistics" description="Latest session and 52-week context" />
          <StatsGrid quote={quote} sector={profile?.sector ?? null} industry={profile?.industry ?? null} />
        </Card>

        <NewsFeed title={`${symbol} news`} symbols={[symbol]} tabs={false} limit={7} />
      </div>
    </div>
  );
}

function ConvertedHint({ quote }: { quote: Quote }) {
  const { displayCurrency, format } = useCurrency();
  if (displayCurrency === "native" || quote.quoteType === "INDEX") return null;
  const converted = format(quote.price, quote.currency, quote.quoteType);
  if (!converted.converted) return null;
  return (
    <p className="mt-1 text-[10px] text-muted">
      ≈ {converted.text} at today&apos;s reference rate
    </p>
  );
}

function StatsGrid({
  quote,
  sector,
  industry,
}: {
  quote: Quote;
  sector: string | null;
  industry: string | null;
}) {
  const position = formatRangePosition(quote.price, quote.fiftyTwoWeekLow, quote.fiftyTwoWeekHigh);
  const stats = useMemo(
    () => [
      { label: "Previous close", value: formatPrice(quote.previousClose, quote.currency) },
      {
        label: "Day range",
        value:
          quote.dayLow != null && quote.dayHigh != null
            ? `${formatPrice(quote.dayLow, quote.currency)} – ${formatPrice(quote.dayHigh, quote.currency)}`
            : "—",
      },
      { label: "Volume", value: formatCompact(quote.volume) },
      { label: "Currency", value: quote.currency ?? "—" },
      { label: "Exchange", value: quote.exchangeName ?? quote.exchange ?? "—" },
      { label: "Sector", value: sector ?? "—" },
    ],
    [quote, sector],
  );

  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wider text-muted">{stat.label}</dt>
            <dd className="tnum mt-0.5 truncate font-mono text-[13px] font-medium">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 border-t border-border/60 pt-4">
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span>52-week range</span>
          <span className="tnum font-mono">
            {formatPrice(quote.fiftyTwoWeekLow, quote.currency)} – {formatPrice(quote.fiftyTwoWeekHigh, quote.currency)}
          </span>
        </div>
        <div className="relative mt-2 h-1.5 rounded-full bg-surface-2">
          {position != null ? (
            <span
              className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow"
              style={{ left: `${position}%` }}
            />
          ) : null}
        </div>
        {industry ? <p className="mt-3 text-[11px] text-muted">Industry · {industry}</p> : null}
      </div>
    </div>
  );
}

function StockSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-3 w-28" />
      <div className="flex items-start gap-4">
        <Skeleton className="size-16 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-9 w-48" />
        </div>
      </div>
      <Skeleton className="h-[380px] rounded-2xl" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </div>
  );
}
