/**
 * Two-layer TTL cache for market data.
 *
 * L1 — in-process `Map`: per function instance, coalesces concurrent loads.
 * L2 — Upstash Redis (`redis.ts`): shared by every instance and user, so a cold
 *      function still avoids the public APIs.
 *
 * Expired entries stay readable for `staleMs` (24 h by default) so a provider
 * outage serves the last good payload marked `stale`, instead of an error.
 * Callers that need that timestamp must read `meta.storedAt`, never `Date.now()`.
 */
import { readShared, writeShared } from "@/lib/redis";

export interface CacheMeta {
  /** Epoch ms when the value was fetched from the provider. */
  storedAt: number;
  /** The fresh TTL expired and the refresh failed: this is a fallback copy. */
  stale: boolean;
}

export interface CacheResult<T> {
  value: T;
  meta: CacheMeta;
}

export interface CacheOptions {
  /** How long the value counts as fresh. */
  ttlMs: number;
  /** How long an expired value may still be served when the refresh fails. */
  staleMs?: number;
  /** `false` keeps the entry in this instance only (per-user or unbounded keys). */
  shared?: boolean;
}

interface Entry<T> {
  value: T;
  storedAt: number;
}

const MAX_ENTRIES = 500;
/** Serve an expired value for up to this long when the upstream call fails. */
export const STALE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Bump when payload shapes change: old Redis entries are then ignored. */
const KEY_PREFIX = "sg:v1";

const entries = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<CacheResult<unknown>>>();

function prune(now: number) {
  for (const [key, entry] of entries) {
    if (entry.storedAt < now - STALE_WINDOW_MS) entries.delete(key);
  }
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

function newest<T>(a: Entry<T> | undefined, b: Entry<T> | null): Entry<T> | undefined {
  if (!a) return b ?? undefined;
  if (!b) return a;
  return b.storedAt > a.storedAt ? b : a;
}

async function readEntry<T>(cacheKey: string): Promise<Entry<T> | null> {
  try {
    const raw = await readShared(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (!parsed || typeof parsed.storedAt !== "number") return null;
    return parsed;
  } catch {
    // The shared cache is best-effort: a corrupt or failing entry is a miss.
    return null;
  }
}

/**
 * Read through L1 then L2, loading on a miss. Returns the value together with
 * when it was fetched, so routes can tell the client how old the data is.
 */
export async function cached<T>(
  key: string,
  { ttlMs, staleMs = STALE_WINDOW_MS, shared = true }: CacheOptions,
  load: () => Promise<T>,
): Promise<CacheResult<T>> {
  const cacheKey = `${KEY_PREFIX}:${key}`;
  const now = Date.now();

  const local = entries.get(cacheKey) as Entry<T> | undefined;
  if (local && local.storedAt + ttlMs > now) {
    return { value: local.value, meta: { storedAt: local.storedAt, stale: false } };
  }

  const pending = inflight.get(cacheKey) as Promise<CacheResult<T>> | undefined;
  if (pending) return pending;

  const promise = (async (): Promise<CacheResult<T>> => {
    // Another instance may already hold a fresher copy than this one.
    const remote = shared ? await readEntry<T>(cacheKey) : null;
    if (remote && remote.storedAt + ttlMs > Date.now()) {
      entries.set(cacheKey, remote);
      return { value: remote.value, meta: { storedAt: remote.storedAt, stale: false } };
    }

    try {
      const value = await load();
      const entry: Entry<T> = { value, storedAt: Date.now() };
      entries.set(cacheKey, entry);
      prune(entry.storedAt);
      if (shared) await persist(cacheKey, entry, ttlMs + staleMs);
      return { value, meta: { storedAt: entry.storedAt, stale: false } };
    } catch (error) {
      const fallback = newest(local, remote);
      if (fallback && Date.now() - fallback.storedAt <= ttlMs + staleMs) {
        entries.set(cacheKey, fallback);
        return { value: fallback.value, meta: { storedAt: fallback.storedAt, stale: true } };
      }
      throw error;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, promise);
  return promise;
}

/** Write-through to Redis. Never throws: L1 already holds the value. */
async function persist<T>(cacheKey: string, entry: Entry<T>, ttlMs: number) {
  try {
    await writeShared(cacheKey, JSON.stringify(entry), ttlMs);
  } catch {
    // Ignore: the next request simply reloads from the provider.
  }
}

/**
 * Provider-level cache: this instance only, value-only API.
 *
 * Redis lives at the route layer (whole payloads with their fetch timestamp);
 * provider helpers still coalesce concurrent calls without a network hop.
 */
export async function memoize<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  return (await cached(key, { ttlMs, shared: false }, load)).value;
}

/** Test helper. */
export function clearMemoCache() {
  entries.clear();
  inflight.clear();
}

export function memoCacheSize() {
  return entries.size;
}
