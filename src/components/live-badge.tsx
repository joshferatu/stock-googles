"use client";

import { CloudOff, Radio } from "lucide-react";

import { useHydrated } from "@/lib/client-hooks";
import { formatFullDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function relativeAge(timestampMs: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

function staleHint(timestampMs: number) {
  return `Live data unavailable — showing the last successful fetch (${formatFullDate(timestampMs / 1000)})`;
}

/**
 * Freshness pill. `stale` means the server served its fallback cache because
 * the providers failed: the copy is still real data, just older.
 */
export function LiveBadge({
  label = "Delayed quote",
  stale = false,
  timestamp,
  className,
}: {
  label?: string;
  stale?: boolean;
  /** Epoch ms of the last successful fetch, used for the stale label. */
  timestamp?: number;
  className?: string;
}) {
  const hydrated = useHydrated();
  const age = stale && hydrated && timestamp ? relativeAge(timestamp) : null;

  return (
    <span
      title={stale && timestamp ? staleHint(timestamp) : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-surface/60 px-2 py-0.5 text-[10px] font-medium",
        stale ? "border-warn/40 text-warn" : "border-border text-muted",
        className,
      )}
    >
      <span className="relative flex size-1.5">
        <span
          className={cn(
            "absolute inline-flex size-full rounded-full",
            stale ? "bg-warn" : "live-dot bg-up",
          )}
        />
        <span className={cn("relative inline-flex size-1.5 rounded-full", stale ? "bg-warn" : "bg-up")} />
      </span>
      {stale ? (age ? `Cached · ${age}` : "Cached data") : label}
    </span>
  );
}

/**
 * "Updated 12s ago" label. When the server served a stale copy it says so
 * instead of pretending the data was just refreshed.
 */
export function UpdatedAgo({
  timestamp,
  prefix = "Updated",
  stale = false,
}: {
  /** Epoch ms when the server last fetched this data from the provider. */
  timestamp: number | null | undefined;
  prefix?: string;
  stale?: boolean;
}) {
  const hydrated = useHydrated();
  if (!hydrated || !timestamp) {
    return <span className="text-[10px] text-muted">—</span>;
  }
  const age = relativeAge(timestamp);

  return (
    <span
      title={stale ? staleHint(timestamp) : undefined}
      className={cn("tnum inline-flex items-center gap-1 text-[10px]", stale ? "text-warn" : "text-muted")}
    >
      {stale ? <CloudOff className="size-2.5" /> : <Radio className="size-2.5" />}
      {stale ? `Cached · ${age}` : `${prefix} ${age}`}
    </span>
  );
}
