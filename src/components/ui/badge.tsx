import * as React from "react";

import { cn } from "@/lib/utils";

export const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "up" | "down" | "accent" | "outline" }
>(function Badge({ className, tone = "neutral", ...props }, ref) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    up: "bg-up/12 text-up",
    down: "bg-down/12 text-down",
    accent: "bg-accent/12 text-accent",
    outline: "border border-border-strong text-muted",
  } as const;
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
});

export function ChangeBadge({
  value,
  className,
  showArrow = true,
}: {
  value: number | null | undefined;
  className?: string;
  showArrow?: boolean;
}) {
  const positive = (value ?? 0) >= 0;
  const formatted =
    value == null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  return (
    <span
      className={cn(
        "tnum inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold",
        positive ? "bg-up/12 text-up" : "bg-down/12 text-down",
        className,
      )}
    >
      {showArrow ? (
        <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
          <path
            d={positive ? "M6 2.5 10 8H2z" : "M6 9.5 2 4h8z"}
            fill="currentColor"
          />
        </svg>
      ) : null}
      {formatted}
    </span>
  );
}
