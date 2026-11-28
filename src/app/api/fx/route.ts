import { cached } from "@/lib/cache";
import { jsonOk } from "@/lib/http";
import type { FxPayload } from "@/lib/types";
import { fetchFxRates } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Daily ECB-style reference rates: cheap to keep, expensive to lose. */
const FX_TTL_MS = 6 * 60 * 60_000;

export async function GET() {
  const { value, meta } = await cached<FxPayload>("fx", { ttlMs: FX_TTL_MS }, async () => {
    const { rates, asOf } = await fetchFxRates();
    return { base: "EUR", rates, asOf, missing: [], stale: false };
  });
  return jsonOk({ ...value, stale: meta.stale }, { sMaxAge: 3600, staleWhileRevalidate: 86400 });
}
