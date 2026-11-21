/**
 * Small in-process TTL cache with request coalescing and stale-on-error.
 *
 * Vercel functions are ephemeral, so this is only the first of two layers:
 * responses also carry `s-maxage` so the CDN absorbs most traffic.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  storedAt: number;
}

const MAX_ENTRIES = 500;
/** Serve an expired value for up to this long when the upstream call fails. */
const STALE_FALLBACK_MS = 6 * 60 * 60 * 1000;

const entries = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function prune(now: number) {
  for (const [key, entry] of entries) {
    if (entry.expiresAt < now - STALE_FALLBACK_MS) entries.delete(key);
  }
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

export async function memoize<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await load();
      entries.set(key, { value, expiresAt: Date.now() + ttlMs, storedAt: Date.now() });
      prune(Date.now());
      return value;
    } catch (error) {
      if (hit && hit.storedAt > Date.now() - STALE_FALLBACK_MS) {
        // Better a slightly old quote than an error screen.
        return hit.value;
      }
      throw error;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/** Test helper. */
export function clearMemoCache() {
  entries.clear();
  inflight.clear();
}

export function memoCacheSize() {
  return entries.size;
}
