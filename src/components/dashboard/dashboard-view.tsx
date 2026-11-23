"use client";

import { LiveBadge } from "@/components/live-badge";
import { FavoritesSummary } from "@/components/dashboard/favorites-summary";
import { MarketStrip } from "@/components/dashboard/market-strip";
import { MoversPanel } from "@/components/dashboard/movers-panel";
import { NewsFeed } from "@/components/dashboard/news-feed";
import { PageHeading } from "@/components/section-header";

export function DashboardView() {
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="animate-fade-up space-y-7">
      <PageHeading
        eyebrow="Stock Googles"
        title="Market overview"
        description={`${today} · global quotes may be delayed by up to 15–20 minutes`}
        action={<LiveBadge />}
      />

      <MarketStrip />

      <FavoritesSummary />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <MoversPanel />
        <NewsFeed />
      </div>
    </div>
  );
}
