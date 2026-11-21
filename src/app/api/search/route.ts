import { z } from "zod";

import { jsonError, jsonOk, providerErrorMessage } from "@/lib/http";
import { searchInstruments } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  q: z.string().trim().min(1).max(80),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) return jsonError("A search query is required.", 400);

  try {
    const results = await searchInstruments(parsed.data.q);
    return jsonOk({ query: parsed.data.q, results, fetchedAt: Date.now() }, { sMaxAge: 120, staleWhileRevalidate: 600 });
  } catch (error) {
    const { message, status } = providerErrorMessage(error);
    return jsonError(message, status);
  }
}
