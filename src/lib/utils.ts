import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deterministic gradient per symbol, used by the fallback "logo". */
export function symbolGradient(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) hash = (hash * 31 + symbol.charCodeAt(i)) % 360;
  const from = hash;
  const to = (hash + 48) % 360;
  return `linear-gradient(135deg, hsl(${from} 70% 45%), hsl(${to} 75% 55%))`;
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
