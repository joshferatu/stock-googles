"use client";

import { AreaSeries, ColorType, CrosshairMode, createChart, LineStyle } from "lightweight-charts";
import type { IChartApi, IPriceLine, ISeriesApi, MouseEventParams, UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

import { formatPrice } from "@/lib/format";
import { formatAxisTick, formatCrosshairTime } from "@/lib/ranges";
import { useSettings } from "@/lib/settings-store";
import type { ChartPayload } from "@/lib/types";

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function withAlpha(color: string, alpha: number) {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return color;
  const value = Number.parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

interface HoverState {
  x: number;
  y: number;
  price: number;
  time: number;
}

export function PriceChart({
  payload,
  currency,
  loading,
  height = 320,
}: {
  payload: ChartPayload | null;
  currency: string | null;
  loading: boolean;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const priceLineRef = useRef<IPriceLine | null>(null);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const [hover, setHover] = useState<HoverState | null>(null);
  const theme = useSettings((state) => state.theme);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const up = cssVar("--up", "#34d399");
    const down = cssVar("--down", "#fb7185");
    const border = cssVar("--border-strong", "rgba(255,255,255,0.14)");
    const muted = cssVar("--muted", "#8894a6");
    const surface = cssVar("--surface-2", "#141a22");
    const gridColor = cssVar("--chart-grid", "rgba(255,255,255,0.05)");
    const current = payloadRef.current;
    const color = (current?.performance ?? 0) >= 0 ? up : down;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: muted,
        fontSize: 10,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: gridColor, style: LineStyle.Solid },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.16, bottom: 0.08 },
        entireTextOnly: true,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: current?.intraday ?? true,
        secondsVisible: false,
        rightOffset: 1,
        barSpacing: 7,
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (time: number) => formatAxisTick(time, current?.intraday ?? true),
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: border, width: 1, style: LineStyle.Dashed, labelBackgroundColor: surface },
        horzLine: { color: border, width: 1, style: LineStyle.Dashed, labelBackgroundColor: surface },
      },
      localization: {
        timeFormatter: (time: number) => formatCrosshairTime(time, current?.intraday ?? true),
      },
      handleScroll: { vertTouchDrag: false },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: withAlpha(color, 0.26),
      bottomColor: withAlpha(color, 0.01),
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3.5,
      crosshairMarkerBorderColor: cssVar("--bg", "#06080b"),
      crosshairMarkerBackgroundColor: color,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    series.applyOptions({
      priceFormat: {
        type: "price",
        precision: current?.series.some((point) => point.value < 1) ? 4 : 2,
        minMove: 0.0001,
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    if (current) {
      series.setData(current.series.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })));
      chart.timeScale().fitContent();
    }

    const handleCrosshair = (param: MouseEventParams) => {
      if (!param.point || param.time === undefined) {
        setHover(null);
        return;
      }
      const data = param.seriesData.get(series) as { value?: number } | undefined;
      if (typeof data?.value !== "number") {
        setHover(null);
        return;
      }
      setHover({
        x: param.point.x,
        y: param.point.y,
        price: data.value,
        time: param.time as number,
      });
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshair);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLineRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || !payload) return;
    setHover(null);

    const up = cssVar("--up", "#34d399");
    const down = cssVar("--down", "#fb7185");
    const color = (payload.performance ?? 0) >= 0 ? up : down;
    const underOne = payload.series.some((point) => point.value < 1);

    series.applyOptions({
      lineColor: color,
      topColor: withAlpha(color, 0.26),
      bottomColor: withAlpha(color, 0.01),
      crosshairMarkerBackgroundColor: color,
      priceFormat: { type: "price", precision: underOne ? 4 : 2, minMove: underOne ? 0.0001 : 0.01 },
    });
    chart.applyOptions({
      timeScale: {
        timeVisible: payload.intraday,
        tickMarkFormatter: (time: number) => formatAxisTick(time, payload.intraday),
      },
      localization: {
        timeFormatter: (time: number) => formatCrosshairTime(time, payload.intraday),
      },
    });

    if (priceLineRef.current) {
      series.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }
    if (payload.range === "1D" && payload.baseline) {
      priceLineRef.current = series.createPriceLine({
        price: payload.baseline,
        color: cssVar("--muted", "#8894a6"),
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: "Prev",
      });
    }

    series.setData(payload.series.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })));
    chart.timeScale().fitContent();
  }, [payload]);

  return (
    <div className="relative">
      {loading ? (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-full bg-border/40">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
        </div>
      ) : null}

      {!payload ? (
        <div className="skeleton rounded-xl" style={{ height }} />
      ) : (
        <div className="relative" style={{ height }}>
          <div ref={containerRef} className="absolute inset-0" />
          {hover ? (
            <div
              className="pointer-events-none absolute z-10 min-w-[110px] rounded-lg border border-border-strong/70 bg-surface/95 px-2.5 py-1.5 text-[10px] shadow-xl backdrop-blur"
              style={{
                left: Math.min(Math.max(hover.x - 55, 0), (containerRef.current?.clientWidth ?? 200) - 116),
                top: Math.max(hover.y - 56, 0),
              }}
            >
              <p className="font-mono text-[11px] font-semibold">{formatPrice(hover.price, currency)}</p>
              <p className="mt-0.5 text-muted">{formatCrosshairTime(hover.time, payload.intraday)}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
