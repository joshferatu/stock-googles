/**
 * Shared cache backend: Upstash Redis, provisioned from the Vercel Marketplace.
 *
 * Vercel injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`; the generic
 * `UPSTASH_REDIS_REST_*` names are accepted for non-Vercel deployments. The
 * TCP URLs (`KV_URL`, `REDIS_URL`) are not used: this client speaks REST.
 *
 * Everything here is best-effort. Without credentials, or when Upstash is slow
 * or failing, `cache.ts` falls back to the in-process cache — Redis must never
 * be able to break a request.
 */
import { Redis } from "@upstash/redis";

const COMMAND_TIMEOUT_MS = 1500;
/** After a failure, stop calling Redis for a while instead of paying the timeout on every request. */
const FAILURE_COOLDOWN_MS = 30_000;

let client: Redis | null | undefined;
let disabledUntil = 0;

function createClient(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({
    url,
    token,
    // Values are JSON envelopes handled by `cache.ts`, so skip client parsing.
    automaticDeserialization: false,
    keepAlive: true,
    // A fresh timeout per command: a slow Upstash must not hold a render open.
    signal: () => AbortSignal.timeout(COMMAND_TIMEOUT_MS),
  });
}

function usable(): Redis | null {
  if (client === undefined) client = createClient();
  if (!client || Date.now() < disabledUntil) return null;
  return client;
}

function disableTemporarily() {
  disabledUntil = Date.now() + FAILURE_COOLDOWN_MS;
}

/** True when a shared Redis cache is configured and not cooling down. */
export function sharedCacheEnabled(): boolean {
  return usable() !== null;
}

export async function readShared(key: string): Promise<string | null> {
  const redis = usable();
  if (!redis) return null;
  try {
    const value = await redis.get<unknown>(key);
    if (value == null) return null;
    // The client may hand back a parsed object depending on its config; always
    // normalise to the raw JSON string so `cache.ts` alone owns parsing.
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    disableTemporarily();
    return null;
  }
}

export async function writeShared(key: string, raw: string, ttlMs: number): Promise<void> {
  const redis = usable();
  if (!redis) return;
  try {
    await redis.set(key, raw, { px: Math.max(1000, Math.round(ttlMs)) });
  } catch {
    disableTemporarily();
  }
}

/**
 * Test helper: drop the cached client and any failure cooldown.
 * Pass `null` to simulate "Redis not configured", or a client to inject one.
 */
export function resetSharedCache(next?: Redis | null) {
  client = next === undefined ? undefined : next;
  disabledUntil = 0;
}
