-- Stock Googles: per-user state.
--
-- One row per signed-in Google account. The document columns are JSONB because
-- every write replaces a whole collection (the UI never queries a single
-- favourite), so a document per user keeps writes atomic and the schema small.
-- Shapes are validated in src/lib/user-state-schema.ts and normalised in
-- src/lib/user-state.ts.

create table if not exists public.user_state (
  user_id         text primary key,
  favorites       jsonb not null default '[]'::jsonb,
  preferences     jsonb not null default '{}'::jsonb,
  recent_searches jsonb not null default '[]'::jsonb,
  updated_at      timestamptz not null default now()
);

comment on table public.user_state is
  'Per-user favourites, preferences and recent searches. user_id is the verified Google email.';
