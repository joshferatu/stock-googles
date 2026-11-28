/**
 * Neon Postgres access.
 *
 * The app talks to Neon over HTTP (stateless, no TCP pool), which is the
 * documented driver choice for Vercel functions. The client is created lazily so
 * a missing `DATABASE_URL` breaks the one route that needs it with a clear error
 * instead of failing the whole build or import graph.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type Query = NeonQueryFunction<false, false>;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set.");
    this.name = "DatabaseNotConfiguredError";
  }
}

let client: Query | null = null;

export function databaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : null;
}

/** Tagged template + `.query()` client. Throws `DatabaseNotConfiguredError`. */
export function db(): Query {
  if (client) return client;
  const url = databaseUrl();
  if (!url) throw new DatabaseNotConfiguredError();
  client = neon(url);
  return client;
}
