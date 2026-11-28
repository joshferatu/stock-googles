/**
 * Per-user state repository: one JSONB document per verified email.
 *
 * Reads and writes are HTTP round-trips to Neon, so a single request costs one
 * round-trip. Whole-collection writes are safe here because the UI always
 * replaces a collection atomically (toggle, reorder, clear, import).
 */

import { db } from "@/lib/db";
import { parseUserState, type UserState } from "@/lib/user-state";

export interface StoredUserState {
  exists: boolean;
  updatedAt: string | null;
  state: UserState;
}

interface StateRow {
  favorites: unknown;
  preferences: unknown;
  recent_searches: unknown;
  updated_at: string | Date | null;
}

function isoDate(value: string | Date | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function readUserState(userId: string): Promise<StoredUserState> {
  const query = db();
  const rows = (await query`
    select favorites, preferences, recent_searches, updated_at
    from public.user_state
    where user_id = ${userId}
    limit 1
  `) as StateRow[];

  const row = rows[0];
  if (!row) {
    return { exists: false, updatedAt: null, state: parseUserState(null) };
  }

  return {
    exists: true,
    updatedAt: isoDate(row.updated_at),
    state: parseUserState({
      favorites: row.favorites,
      preferences: row.preferences,
      recentSearches: row.recent_searches,
    }),
  };
}

export async function writeUserState(
  userId: string,
  state: UserState,
): Promise<{ updatedAt: string | null }> {
  const query = db();
  const favorites = JSON.stringify(state.favorites);
  const preferences = JSON.stringify(state.preferences);
  const recentSearches = JSON.stringify(state.recentSearches);

  const rows = (await query`
    insert into public.user_state (user_id, favorites, preferences, recent_searches, updated_at)
    values (${userId}, ${favorites}::jsonb, ${preferences}::jsonb, ${recentSearches}::jsonb, now())
    on conflict (user_id) do update
      set favorites = excluded.favorites,
          preferences = excluded.preferences,
          recent_searches = excluded.recent_searches,
          updated_at = now()
    returning updated_at
  `) as { updated_at: string | Date | null }[];

  return { updatedAt: isoDate(rows[0]?.updated_at ?? null) };
}
