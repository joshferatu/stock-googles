"use client";

import { Radio } from "lucide-react";

import { useHydrated } from "@/lib/client-hooks";
import { cn } from "@/lib/utils";

export function LiveBadge({ label = "Delayed quote", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/60 px-2 py-0.5 text-[10px] font-medium text-muted",
        className,
      )}
    >
      <span className="relative flex size-1.5">
        <span className="live-dot absolute inline-flex size-full rounded-full bg-up" />
        <span className="relative inline-flex size-1.5 rounded-full bg-up" />
      </span>
      {label}
    </span>
  );
}

export function UpdatedAgo({ timestamp, prefix = "Updated" }: { timestamp: number | null | undefined; prefix?: string }) {
  const hydrated = useHydrated();
  if (!hydrated || !timestamp) {
    return <span className="text-[10px] text-muted">—</span>;
  }
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  const label =
    seconds < 10 ? "just now" : seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.round(seconds / 60)}m ago` : `${Math.round(seconds / 3600)}h ago`;
  return (
    <span className="tnum inline-flex items-center gap-1 text-[10px] text-muted">
      <Radio className="size-2.5" />
      {prefix} {label}
    </span>
  );
}
