/**
 * Per-user state (favourites, preferences, recent searches).
 *
 * The Neon row keyed by the verified Google email is the source of truth; the
 * browser keeps a local cache for offline reads. Responses are always
 * `no-store`: this data is per-user and must never hit the CDN.
 */

import { currentUserEmail } from "@/lib/current-user";
import { databaseUrl } from "@/lib/db";
import { jsonError, jsonNoStore } from "@/lib/http";
import { parseUserState } from "@/lib/user-state";
import { readUserState, writeUserState } from "@/lib/user-state-repo";
import { userStateSchema } from "@/lib/user-state-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NOT_CONFIGURED = "User data sync is not configured on this deployment.";

function logFailure(action: string, error: unknown) {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";
  // Never log cookies or tokens; the driver error only carries the SQL message.
  console.error(`[user-state] ${action} failed (${detail})`);
}

export async function GET(request: Request) {
  const email = await currentUserEmail(request);
  if (!email) return jsonError("Unauthorized", 401);
  if (!databaseUrl()) return jsonError(NOT_CONFIGURED, 503);

  try {
    return jsonNoStore(await readUserState(email));
  } catch (error) {
    logFailure("read", error);
    return jsonError("Could not load your saved data.", 500);
  }
}

export async function PUT(request: Request) {
  const email = await currentUserEmail(request);
  if (!email) return jsonError("Unauthorized", 401);
  if (!databaseUrl()) return jsonError(NOT_CONFIGURED, 503);

  const body = await request.json().catch(() => null);
  const parsed = userStateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("That data could not be saved.", 400);
  }

  try {
    // Zod bounds the payload; the normalisers apply canonical defaults.
    const state = parseUserState(parsed.data);
    const saved = await writeUserState(email, state);
    return jsonNoStore({ ok: true, updatedAt: saved.updatedAt, state });
  } catch (error) {
    logFailure("write", error);
    return jsonError("Could not save your data.", 500);
  }
}
