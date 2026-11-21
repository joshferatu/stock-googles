/** Locale-stable formatting helpers (always en-US so tests and UI agree). */

const LOCALE = "en-US";

const priceDigits = (value: number) => {
  const abs = Math.abs(value);
  if (abs === 0) return 2;
  if (abs >= 1) return 2;
  if (abs >= 0.01) return 4;
  return 6;
};

export function formatPrice(value: number | null | undefined, currency?: string | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = priceDigits(value);
  if (!currency) {
    return new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  }
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(value)} ${currency}`;
  }
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatSignedPrice(
  value: number | null | undefined,
  currency?: string | null,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatPrice(Math.abs(value), currency)}`;
}

export function formatRelativeTime(unixSeconds: number | null | undefined, now = Date.now()): string {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return "—";
  const deltaMs = now - unixSeconds * 1000;
  if (deltaMs < 60_000) return "just now";
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric" }).format(
    new Date(unixSeconds * 1000),
  );
}

export function formatMarketClock(unixSeconds: number | null | undefined, timezone?: string | null): string {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return "—";
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone ?? "UTC",
      hour12: false,
    }).format(new Date(unixSeconds * 1000));
  } catch {
    return new Intl.DateTimeFormat(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(new Date(unixSeconds * 1000));
  }
}

export function formatFullDate(unixSeconds: number | null | undefined, timezone?: string | null): string {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return "—";
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone ?? "UTC",
    }).format(new Date(unixSeconds * 1000));
  } catch {
    return new Date(unixSeconds * 1000).toISOString().slice(0, 16).replace("T", " ");
  }
}

export function formatRangePosition(
  value: number | null | undefined,
  low: number | null | undefined,
  high: number | null | undefined,
): number | null {
  if (value == null || low == null || high == null || high <= low) return null;
  return Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100));
}

export function marketStateLabel(state: string | null | undefined): string {
  switch (state) {
    case "PRE":
      return "Pre-market";
    case "OPEN":
      return "Market open";
    case "POST":
      return "After hours";
    case "CLOSED":
      return "Market closed";
    default:
      return "Session unknown";
  }
}

export function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
