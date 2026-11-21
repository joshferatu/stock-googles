import { describe, expect, it } from "vitest";

import {
  formatCompact,
  formatFullDate,
  formatMarketClock,
  formatPercent,
  formatPrice,
  formatRangePosition,
  formatRelativeTime,
  formatSignedPrice,
  initials,
  marketStateLabel,
} from "@/lib/format";

describe("formatPrice", () => {
  it("formats currencies with two decimals", () => {
    expect(formatPrice(342.56, "USD")).toBe("$342.56");
    expect(formatPrice(3.363, "EUR")).toBe("€3.36");
  });

  it("uses more decimals for sub-dollar prices", () => {
    expect(formatPrice(0.0042, "USD")).toBe("$0.004200");
  });

  it("handles missing values and unknown currencies", () => {
    expect(formatPrice(null, "USD")).toBe("—");
    expect(formatPrice(undefined)).toBe("—");
    expect(formatPrice(12.5, "ZZZ").replace(/\u00a0/g, " ")).toBe("ZZZ 12.50");
  });
});

describe("percent and compact formatting", () => {
  it("signs percentages", () => {
    expect(formatPercent(1.234)).toBe("+1.23%");
    expect(formatPercent(-2.5)).toBe("-2.50%");
    expect(formatPercent(0)).toBe("0.00%");
    expect(formatPercent(null)).toBe("—");
  });

  it("formats large numbers compactly", () => {
    expect(formatCompact(80_568_107)).toBe("80.6M");
    expect(formatCompact(null)).toBe("—");
  });

  it("formats signed absolute prices", () => {
    expect(formatSignedPrice(-1.5, "USD")).toBe("-$1.50");
    expect(formatSignedPrice(2.25, "EUR")).toBe("+€2.25");
  });
});

describe("time formatting", () => {
  const now = Date.UTC(2024, 0, 2, 12, 0, 0);

  it("formats relative times", () => {
    expect(formatRelativeTime(now / 1000 - 5, now)).toBe("just now");
    expect(formatRelativeTime(now / 1000 - 60 * 3, now)).toBe("3m ago");
    expect(formatRelativeTime(now / 1000 - 3600 * 5, now)).toBe("5h ago");
    expect(formatRelativeTime(now / 1000 - 86_400 * 2, now)).toBe("2d ago");
  });

  it("formats clocks in a given timezone", () => {
    expect(formatMarketClock(Date.UTC(2024, 0, 2, 15, 4, 0) / 1000, "UTC")).toBe("15:04");
  });

  it("formats full dates", () => {
    expect(formatFullDate(Date.UTC(2024, 0, 2, 15, 4, 0) / 1000, "UTC")).toContain("2024");
  });
});

describe("misc formatters", () => {
  it("positions a value in a range", () => {
    expect(formatRangePosition(50, 0, 100)).toBe(50);
    expect(formatRangePosition(0, 0, 100)).toBe(0);
    expect(formatRangePosition(100, 0, 100)).toBe(100);
    expect(formatRangePosition(150, 0, 100)).toBe(100);
    expect(formatRangePosition(null, 0, 100)).toBeNull();
    expect(formatRangePosition(50, 100, 100)).toBeNull();
  });

  it("labels market states", () => {
    expect(marketStateLabel("OPEN")).toBe("Market open");
    expect(marketStateLabel("POST")).toBe("After hours");
    expect(marketStateLabel(undefined)).toBe("Session unknown");
  });

  it("derives initials", () => {
    expect(initials("Apple Inc.")).toBe("AI");
    expect(initials("Telefónica, S.A.")).toBe("TS");
    expect(initials("")).toBe("?");
  });
});
