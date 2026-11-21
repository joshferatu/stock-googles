"use client";

import { Select } from "@/components/ui/input";
import type { DisplayCurrency } from "@/lib/fx";
import { useSettings } from "@/lib/settings-store";

const LABELS: Record<DisplayCurrency, string> = {
  native: "Native",
  EUR: "EUR",
  USD: "USD",
};

export function CurrencySwitcher({ compact = false }: { compact?: boolean }) {
  const displayCurrency = useSettings((state) => state.displayCurrency);
  const setDisplayCurrency = useSettings((state) => state.setDisplayCurrency);

  return (
    <label className="relative inline-flex items-center gap-1" title="Display currency">
      {!compact ? <span className="text-[10px] uppercase tracking-wider text-muted">Currency</span> : null}
      <Select
        aria-label="Display currency"
        value={displayCurrency}
        onChange={(event) => setDisplayCurrency(event.target.value as DisplayCurrency)}
      >
        {(Object.keys(LABELS) as DisplayCurrency[]).map((currency) => (
          <option key={currency} value={currency}>
            {LABELS[currency]}
          </option>
        ))}
      </Select>
    </label>
  );
}
