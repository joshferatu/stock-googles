import { NextResponse } from "next/server";

/**
 * Market responses are identical for every user, so they can be cached by the
 * CDN and revalidated in the background. Per-user data must use `jsonNoStore`.
 */
export function jsonOk(
  data: unknown,
  { sMaxAge = 60, staleWhileRevalidate = 300 }: { sMaxAge?: number; staleWhileRevalidate?: number } = {},
) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    },
  });
}

export function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, must-revalidate" },
  });
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function providerErrorMessage(error: unknown): { message: string; status: number } {
  if (error instanceof Error) {
    const status = (error as { status?: number }).status;
    if (status === 404) {
      return { message: error.message, status: 404 };
    }
    if (status === 400) {
      return { message: error.message, status: 400 };
    }
  }
  return {
    message: "Market data is temporarily unavailable. Please try again in a moment.",
    status: 502,
  };
}
