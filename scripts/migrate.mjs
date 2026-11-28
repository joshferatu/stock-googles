#!/usr/bin/env node
/**
 * Applies db/schema.sql to the Neon database.
 *
 * Uses the unpooled connection when available (DDL and migrations should not go
 * through a pooler) and the Neon HTTP driver, so no local Postgres is needed:
 *
 *   npm run db:migrate
 *
 * Copy DATABASE_URL_UNPOOLED into .env.local from Vercel → Storage → Neon;
 * integration secrets are encrypted and `vercel env pull` writes a placeholder.
 *
 * The schema is idempotent (`create table if not exists`), so re-running is safe.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error(
    "DATABASE_URL_UNPOOLED (or DATABASE_URL) must be set. Copy it from Vercel → Storage → Neon → .env.local (vercel env pull writes a placeholder for encrypted values).",
  );
  process.exit(1);
}

const schemaPath = fileURLToPath(new URL("../db/schema.sql", import.meta.url));
const source = await readFile(schemaPath, "utf8");

/** Drop `--` comment lines, then split on terminators. */
const statements = source
  .split(";")
  .map((chunk) =>
    chunk
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean);

const sql = neon(connectionString);

for (const statement of statements) {
  await sql.query(statement);
  console.log(`ok  ${statement.split("\n")[0].trim().slice(0, 70)}`);
}

console.log(`\nApplied ${statements.length} statement(s) from db/schema.sql`);
