import { describe, expect, it } from "vitest";

import { convertAmount } from "@/lib/fx";

const rates = { USD: 1.1, GBP: 0.85, JPY: 170, EUR: 1 };

describe("convertAmount", () => {
  it("converts through EUR reference rates", () => {
    expect(convertAmount(110, "USD", "EUR", rates)).toBeCloseTo(100, 5);
    expect(convertAmount(100, "EUR", "USD", rates)).toBeCloseTo(110, 5);
    expect(convertAmount(110, "USD", "GBP", rates)).toBeCloseTo(85, 5);
  });

  it("returns the same value for identical or missing currencies", () => {
    expect(convertAmount(10, "USD", "USD", rates)).toBe(10);
    expect(convertAmount(10, null, "USD", rates)).toBeNull();
    expect(convertAmount(10, "USD", "EUR", undefined)).toBeNull();
  });

  it("returns null for currencies missing from the rate table", () => {
    expect(convertAmount(10, "KRW", "EUR", rates)).toBeNull();
  });
});
