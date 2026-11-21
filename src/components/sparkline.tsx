"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Tiny SVG sparkline. Rendered as a path instead of a charting instance:
 * dozens of these live on the dashboard, so this keeps scrolling cheap.
 */
export function Sparkline({
  data,
  positive,
  width = 104,
  height = 32,
  strokeWidth = 1.6,
  className,
  filled = true,
}: {
  data: readonly number[];
  positive: boolean;
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  filled?: boolean;
}) {
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!data || data.length < 2) {
    return <div className={cn("h-8 w-[104px]", className)} aria-hidden />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = strokeWidth;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${(width - pad).toFixed(2)},${height} L${pad.toFixed(2)},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn(positive ? "text-up" : "text-down", "overflow-visible", className)}
      aria-hidden
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`spark-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled ? <path d={area} fill={`url(#spark-${gradientId})`} /> : null}
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
