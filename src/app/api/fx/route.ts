import { jsonOk } from "@/lib/http";
import type { FxPayload } from "@/lib/types";
import { fetchFxRates } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { rates, asOf } = await fetchFxRates();
  const payload: FxPayload = {
    base: "EUR",
    rates,
    asOf,
    missing: [],
  };
  // Daily ECB-style rates: cache hard.
  return jsonOk(payload, { sMaxAge: 3600, staleWhileRevalidate: 86400 });
}
