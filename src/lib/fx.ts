import type { FxPayload } from "@/lib/types";

/**
 * Convert between currencies using a EUR-based rate table.
 * Returns null when either currency is missing, so callers can fall back to native.
 */
export function convertAmount(
  value: number,
  from: string | null | undefined,
  to: string | null | undefined,
  rates: Record<string, number> | undefined,
): number | null {
  if (!Number.isFinite(value)) return null;
  if (!from || !to) return null;
  if (from === to) return value;
  if (!rates) return null;
  const fromRate = from === "EUR" ? 1 : rates[from];
  const toRate = to === "EUR" ? 1 : rates[to];
  if (!fromRate || !toRate) return null;
  return (value / fromRate) * toRate;
}

export type DisplayCurrency = "native" | "EUR" | "USD";

export function ratesFor(payload: FxPayload | undefined): Record<string, number> | undefined {
  if (!payload) return undefined;
  return { ...payload.rates, EUR: 1 };
}
