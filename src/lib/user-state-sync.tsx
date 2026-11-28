"use client";

import { useEffect, useRef } from "react";

import { apiSend } from "@/lib/api-client";
import { FAVORITES_STORAGE_KEY, useFavorites } from "@/lib/favorites-store";
import { useUserState } from "@/lib/queries";
import { RECENT_SEARCHES_STORAGE_KEY, useRecentSearches } from "@/lib/recent-searches";
import { SETTINGS_STORAGE_KEY, THEME_STORAGE_KEY, useSettings } from "@/lib/settings-store";
import { DEFAULT_PREFERENCES, hasUserState, type UserState } from "@/lib/user-state";

/**
 * Bridges the Zustand stores and the per-user document in Neon.
 *
 * The database is the source of truth; the stores are its local cache, so the
 * star toggle, theme switch and recents stay instant. Writes are debounced and
 * last-write-wins between devices.
 *
 * Boot order:
 *  1. a previous write failed, or this account has no row yet but the browser
 *     does (first run after the localStorage era) -> push local state;
 *  2. otherwise adopt the server copy.
 */

const PENDING_KEY = "sg:user-state:pending:v1";
const SAVE_DELAY_MS = 600;
/** Set while signing out, so clearing the cache is not written back to the DB. */
let suspended = false;

function markPending(pending: boolean) {
  try {
    if (pending) window.localStorage.setItem(PENDING_KEY, "1");
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Private mode: the flag is an optimisation, not a requirement.
  }
}

function isPending() {
  try {
    return window.localStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

/** Current store contents in the shape the API persists. */
export function snapshotUserState(): UserState {
  const { theme, displayCurrency } = useSettings.getState();
  return {
    favorites: useFavorites.getState().favorites,
    preferences: { theme, displayCurrency },
    recentSearches: useRecentSearches.getState().items,
  };
}

/** Writes server state into the local stores. */
export function applyUserState(state: UserState) {
  useFavorites.getState().setFavorites(state.favorites);
  useSettings.getState().hydratePreferences(state.preferences);
  useRecentSearches.getState().replaceAll(state.recentSearches);
}

async function putUserState(state: UserState): Promise<boolean> {
  try {
    await apiSend("/api/user/state", "PUT", state);
    return true;
  } catch {
    // Offline or server-side failure: keep the local copy and retry later.
    return false;
  }
}

/**
 * Drops the browser cache when signing out, so a different account on the same
 * browser cannot see it. The database row is left untouched.
 */
export function clearLocalUserData() {
  suspended = true;
  useFavorites.getState().setFavorites([]);
  useSettings.getState().hydratePreferences(DEFAULT_PREFERENCES);
  useRecentSearches.getState().replaceAll([]);
  try {
    for (const key of [
      FAVORITES_STORAGE_KEY,
      SETTINGS_STORAGE_KEY,
      THEME_STORAGE_KEY,
      RECENT_SEARCHES_STORAGE_KEY,
      PENDING_KEY,
      "sg:query-cache:v1",
    ]) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Private mode: nothing to clear.
  }
}

/** Mounted once by `AppShell`. Renders nothing. */
export function UserStateSync() {
  const { data, isSuccess } = useUserState();
  const started = useRef(false);

  useEffect(() => {
    if (!isSuccess || !data || started.current) return;
    started.current = true;

    /** Serialised form of the last document known to be on the server. */
    let baseline = "";
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let queued = false;

    /**
     * Sends the current store contents. Always reads the latest snapshot, so a
     * change made during a request is picked up by the queued run. The baseline
     * only advances on success: a failed write leaves the pending flag set, so
     * the next `online` event or change retries it.
     */
    const push = async (): Promise<void> => {
      if (suspended) return;
      if (inFlight) {
        queued = true;
        return;
      }
      const state = snapshotUserState();
      const serialized = JSON.stringify(state);
      if (serialized === baseline) return;

      inFlight = true;
      markPending(true);
      const ok = await putUserState(state);
      inFlight = false;
      if (ok) {
        baseline = serialized;
        markPending(false);
      }
      if (queued) {
        queued = false;
        void push();
      }
    };

    const schedule = () => {
      if (suspended) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void push();
      }, SAVE_DELAY_MS);
    };

    if (isPending() || (!data.exists && hasUserState(snapshotUserState()))) {
      // Adopt the browser copy: first boot after the localStorage era, or a
      // write that failed on a previous visit.
      void push();
    } else {
      applyUserState(data.state);
      baseline = JSON.stringify(snapshotUserState());
    }

    const unsubscribe = [
      useFavorites.subscribe(schedule),
      useSettings.subscribe(schedule),
      useRecentSearches.subscribe(schedule),
    ];
    const onOnline = () => {
      void push();
    };
    window.addEventListener("online", onOnline);

    return () => {
      for (const off of unsubscribe) off();
      window.removeEventListener("online", onOnline);
      if (timer) clearTimeout(timer);
    };
  }, [isSuccess, data]);

  return null;
}
