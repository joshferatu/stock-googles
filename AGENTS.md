# AGENTS.md

Guidance for AI coding agents working in this repository. Read it before changing code.

## What this project is

**Stock Googles** is a single-tenant market dashboard deployed on Vercel. A small group of users sign in with Google, search global listings, follow companies, and see a personalised market overview.

Hard constraints:

- **One database, one purpose.** Postgres (Neon, provisioned through Vercel) stores *only* per-user favourites, display preferences and recent searches, keyed by the verified Google email. No other server-side state: no sessions table, no analytics store, no quote caching in the database.
- **The database is the source of truth for user data; `localStorage` is a cache.** Every change is written through to `/api/user/state`. Reads fall back to the browser copy when the API is unreachable.
- **Keyless public APIs with a provider chain.** Yahoo Finance is primary; StockAnalysis, TradingView, CNBC, Nasdaq, Google News RSS and open.er-api.com provide fallbacks. No paid keys.
- **Thin server.** Next.js route handlers proxy and normalise upstream data, or read/write the single `user_state` table. No background workers, no queues.
- **Vercel-first.** No cron jobs or extra services.

## Quick commands

```bash
npm run dev         # local dev server, http://localhost:3000
npm run build       # production build
npm run start       # serve the production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm test            # Vitest unit tests
npm run test:e2e    # Playwright (builds, starts :3100, mocks market APIs + user state)
npm run db:migrate  # apply db/schema.sql to Neon (idempotent)
npm run icons       # regenerate PWA PNGs from public/icons/*.svg
```

Never run `next dev` and `next start` at the same time: they share `.next` and corrupt each other's chunks. Stop one before starting the other.

## Environment variables

| Variable | Effect |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string. Injected by the Vercel Neon integration into Preview/Production only, as an **encrypted** variable: `vercel env pull` writes the literal placeholder `[SENSITIVE]`, so copy the value from Vercel → Storage → Neon → `.env.local` for local work. |
| `DATABASE_URL_UNPOOLED` | Direct connection; used by `npm run db:migrate`. |
| `AUTH_SECRET` | HMAC key for signed cookies. Falls back to a value derived from `GOOGLE_CLIENT_SECRET`, and to a local-only constant in mock mode. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OIDC. Both are required — Google SSO is the only gate. |
| `GOOGLE_ALLOWED_DOMAIN` | Allowed Google email domain. Defaults to `gmail.com`. |
| `GOOGLE_AUTH_MOCK` | Local/E2E only; simulates Google. Ignored when `VERCEL_ENV=production`. |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin; builds the OAuth redirect URI and Open Graph metadata. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Privacy contact shown on the public `/privacy` page. |

`AUTH_PASSWORD` is retired. It is no longer read anywhere; do not reintroduce it.

`middleware.ts` reads auth env at **build time** (Edge runtime inlining). Changing these variables requires a rebuild/redeploy. The login routes and `/api/user/state` read env at runtime.

## Architecture

```
db/schema.sql             user_state table (single table, JSONB documents)
scripts/migrate.mjs       applies db/schema.sql over the Neon HTTP driver
src/app/
  (app)/                  authenticated shell and pages: dashboard, favorites,
                          search, stock/[symbol]
  api/                    proxy routes: search, quotes, chart, news, movers,
                          markets, fx
  api/user/state/         per-user document: GET + PUT (session required)
  api/auth/               google/{start,callback,mock}, logout, session
  login/                  /login redirects to /login/google (Google only)
  privacy/                public privacy policy (no login, Google OAuth review)
  offline/                PWA fallback page
src/components/           dashboard, stock, search, settings, UI primitives
src/lib/
  yahoo.ts                primary adapter, direct + Jina proxy transport
  cnbc.ts                 keyless quote fallback
  stockanalysis.ts        search + US daily chart fallback
  tradingview.ts          global search + quote fallback
  nasdaq.ts               US search fallback
  google-news.ts          RSS news fallback
  symbols.ts              canonical (Yahoo-style) ↔ provider symbol mapping
  cache.ts                in-process TTL cache, in-flight coalescing, stale-on-error
  types.ts                normalised domain types shared by server and client
  queries.ts              TanStack Query hooks, query keys, currency formatting, prefetch
  db.ts                   lazy Neon HTTP client
  user-state.ts           user-state types, limits and normalisers (shared)
  user-state-schema.ts    Zod validation for PUT /api/user/state
  user-state-repo.ts      user_state SQL reads/writes
  user-state-sync.tsx     store ↔ API write-through used by Providers
  current-user.ts         verified email from the session cookie
  favorites-store.ts      Zustand + persist (localStorage cache of watchlist)
  settings-store.ts       theme + display currency (localStorage cache)
  recent-searches.ts      Zustand + persist (localStorage cache)
  session.ts              signed session/OAuth tokens; Web Crypto only (edge-safe)
  google.ts               Google OIDC helpers (auth URL, token exchange, userinfo)
  http.ts                 JSON response helpers + Cache-Control policy
  ranges.ts               chart range → Yahoo range/interval/TTL mapping
  universe.ts             index list + 136-symbol movers universe
src/middleware.ts         Google-session gate
tests/unit/               Vitest tests (adapters, formats, session, user state, cache, store)
tests/e2e/                Playwright specs + deterministic mock fixtures
```

Data flow, market data: browser → TanStack Query hook (`src/lib/queries.ts`) → `/api/*` route → provider chain → normalised types. Yahoo is attempted directly, then through the `r.jina.ai` reader proxy; each data type has additional fallbacks (see Provider notes). Routes respond with `jsonOk` (`s-maxage` + `stale-while-revalidate`).

Data flow, user data: Zustand store → `UserStateSync` (600 ms debounce) → `PUT /api/user/state` → `user-state-repo.ts` → Neon. On boot, `GET /api/user/state` seeds the stores.

## User state (Neon)

One row per verified Google email in `public.user_state`:

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `text` primary key | Lower-cased verified email from the session cookie. |
| `favorites` | `jsonb` | `{ symbol, name, exchange, quoteType, addedAt }[]`, max 200. |
| `preferences` | `jsonb` | `{ theme, displayCurrency }`. |
| `recent_searches` | `jsonb` | `{ symbol, name, exchangeName, quoteType }[]`, max 8. |
| `updated_at` | `timestamptz` | Set on every write. |

Rules:

- **Whole-document writes only.** The UI replaces a collection atomically, so `PUT` sends the full `{ favorites, preferences, recentSearches }` and the repo upserts. A missing collection is a validation error: a partial payload must never blank a row.
- **Bounds live in `src/lib/user-state.ts`** (`MAX_FAVORITES`, `RECENT_SEARCH_LIMIT`) and are reused by the Zod schema, so the client cache, API and database agree.
- **Writes are strict, reads are lenient.** Zod rejects unknown enum values on `PUT`; `parseFavorites`/`parsePreferences` normalise whatever the database returns (older rows, hand-edited JSON).
- **Identity never comes from the client.** `currentUserEmail(request)` verifies the `sg_session` cookie. Never accept a user id, email or workspace from the body or query string.
- **Never cache this data.** `/api/user/state` responds `no-store` (use `jsonNoStore`), and the query is excluded from the persisted TanStack cache (`providers.tsx`) so a restored copy cannot shadow a newer one from another device.
- **Migration from the localStorage era is automatic**: if the account has no row but the browser does, the local copy is pushed on first boot. `sg:user-state:pending:v1` marks a write that has not reached the server yet.
- Schema changes: edit `db/schema.sql` (keep it idempotent), then `npm run db:migrate`, and update `user-state.ts`, `user-state-schema.ts`, `user-state-repo.ts` and the privacy policy together.

## Provider notes (important)

- **Symbols are Yahoo-style**, e.g. `AAPL`, `TEF.MC`, `^IXIC`, `BRK-B`. Validate with the regex in `src/lib/yahoo.ts`.
- Yahoo's **spark** endpoint is used for quotes because the richer `/v7/finance/quote` endpoint requires a crumb. Spark accepts **max 20 symbols per request** and returns price, change, day/52-week ranges, volume and an intraday close series.
- Yahoo rate-limits aggressively (429). On 429, `yahoo.ts` sets a **90 s cooldown** and falls back to `r.jina.ai` (same Yahoo JSON through a different network). If the proxy is also cooling down, route-level fallbacks take over. Do not add retry loops that hammer Yahoo or Jina.
- **Jina proxy budget:** ~20 requests/minute on the free tier. The adapter tracks `x-ratelimit-remaining` and sets a 60 s cooldown when it gets low. News deliberately opts out (`allowProxy: false`) and uses Google News RSS instead. Movers uses 7 batched requests every 8 minutes.
- **Fallback providers:**
  - StockAnalysis (`stockanalysis.ts`): global search; US-only daily bars via `/api/symbol/s/{id}/history`. No intraday. Fallback charts set `source: "stockanalysis"` and a `note` shown in the UI.
  - TradingView (`tradingview.ts`): global symbol search and scanner quotes. Its search cannot resolve `EURONEXT` to a single Yahoo suffix, so those rows are skipped. Quotes have no sparkline/day ranges.
  - Nasdaq (`nasdaq.ts`): US autocomplete only.
  - Google News RSS (`google-news.ts`): per-ticker and market news when Yahoo fails.
  - CNBC (`cnbc.ts`): quote fallback with index ticker mapping (`^IXIC` ↔ `.IXIC`).
- **Canonical symbols:** all providers map back to Yahoo-style symbols via `symbols.ts`. Do not return provider-native ids to the UI.
- `normalizeSymbols(symbols, limit)` caps user quote batches at 40. Movers passes `250` so the full 136-name universe is scanned.
- CNBC uses exchange-suffixed tickers too, but indices need mapping (`^IXIC` → `.IXIC`). Add new index mappings to `INDEX_TO_CNBC` in `src/lib/cnbc.ts`. CNBC provides no historical bars.
- Chart timestamps are **shifted by the exchange's UTC offset** and formatted as UTC on the client so axis labels show exchange-local time. Do not "fix" this by using the browser timezone.
- Yahoo caps `range=max` history at roughly 3-month granularity. That is expected.
- FX rates come from open.er-api.com with a Frankfurter fallback, cached six hours. They are display-only; never use them for accounting.
- `MAX_NEWS_SYMBOLS = 8` bounds news fan-out. Keep it small; each symbol is one Yahoo request.

## Caching layers

1. Browser: TanStack Query persists successful *market* queries to `localStorage` for 24 h (`Providers`), except `search` and `user-state`. User state is cached by the Zustand stores instead. Assets are cache-first in the service worker.
2. Server memory: `memoize(key, ttl, loader)` in `src/lib/cache.ts`; deduplicates concurrent loads and serves stale values for up to 6 h on failure. Never memoize per-user data — the key space is unbounded and it would leak across users.
3. CDN: route `Cache-Control` via `jsonOk` (`s-maxage`, `stale-while-revalidate`). Keep TTLs aligned with `src/lib/ranges.ts` and the route.
4. Service worker: static/navigation only. **API responses are intentionally not cached** because auth must stay live; browser query persistence covers offline reads.

## Auth (Private Alpha, Google only)

- **One gate — Google OIDC.** `/login/google` → `/api/auth/google/start` (random state + PKCE S256, signed 10-minute `sg_oauth` cookie) → Google → `/api/auth/google/callback`. The callback exchanges the code, reads Google userinfo, requires `email_verified` and an address in `GOOGLE_ALLOWED_DOMAIN` (default `gmail.com`), then issues a 30-day `sg_session` containing the email.
- **The retired shared-password gate is gone.** Do not reinstate `AUTH_PASSWORD`, `sg_gate` or a password route. Sessions without an email are rejected by `verifySessionToken`, so old cookies are invalid.
- **Tokens:** `base64url(JSON).base64url(HMAC-SHA256)` with an `exp` claim. Use `safeNextPath` for all redirects.
- **Middleware:** `open` → no auth; `google`/`mock` → a session with an email. Public: `/login`, `/login/google`, `/privacy`, `/api/auth/*`, `/offline`, PWA assets. `/login` forwards to `/login/google` (kept because it is the OAuth client's registered home page).
- **Settings/logout:** `/api/auth/session` returns `email`, `name`, `mode`, `sso`; Settings shows the email next to Sign out. Logout clears `sg_session` and `sg_oauth` locally; it does not sign out of Google and does not delete the database row.
- **Mock mode:** `GOOGLE_AUTH_MOCK=1` (local/E2E) turns `/login/google` into an email form and enables `/api/auth/google/mock`. `googleAuthConfig()` ignores it when `VERCEL_ENV=production`. Do not use it as a production login.
- **Identity only:** Google SSO never touches market data; do not add Google Finance/Sheets calls here.
- Never log or expose `AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`, OAuth codes or session tokens. Keep PKCE and state verification intact.

## Frontend conventions

- **Persisted state hydration:** any markup that differs between server render and client hydration must be gated with `useHydrated()` (`src/lib/client-hooks.ts`). This applies to favourites, theme and anything read from `localStorage`.
- **Module-init ordering:** `persist` hydrates synchronously for `localStorage`, so constants used by `merge`/`parseFavorites` must be declared **above** the store. The previous TDZ bug made favourites silently disappear.
- **Stores are caches, not the source of truth.** Mutate them optimistically as before; `UserStateSync` handles persistence. Do not add `fetch` calls to components for user data, and do not `setState` on a store from a route.
- **Hydration from the server replaces, never merges.** `setFavorites`/`hydratePreferences`/`replaceAll` exist for `applyUserState`; keep them separate from the user-facing mutations so the echo cannot fight the debounce.
- **Favourites spelling:** the UI uses British "favourites" and the brand is "Stock Googles"; keep copy consistent.
- **Styling:** Tailwind v4 with CSS variables in `src/app/globals.css` (`--bg`, `--surface`, `--up`, `--down`, `--accent`, …). Use token utilities (`bg-surface`, `text-muted`, `text-up`) rather than raw hex values. Charts read these variables via `getComputedStyle`.
- **Components:** shadcn-style local components live in `src/components/ui/`; no component library runtime. Prefer `cn()` from `src/lib/utils.ts`.
- **Numbers:** use formatters from `src/lib/format.ts` (`en-US`, tabular numbers). Do not call `Intl` ad hoc.
- **Native feel:** keep route transitions client-side, add skeletons rather than layout jumps, prefetch on hover (`usePrefetchStock`), and keep the optimistic star behaviour.
- **Query keys** live in `queryKeys`; do not hand-write key arrays. `useQuotes` writes each quote into `["quote", symbol]` so detail pages reuse dashboard data. `["user-state"]` is never refetched in the background: the sync layer owns it.

## API route rules

- Every market route exports `dynamic = "force-dynamic"` and `runtime = "nodejs"` so nothing is fetched at build time.
- Validate input with Zod; return `jsonError(message, status)`.
- Map provider failures through `providerErrorMessage`; do not leak stack traces.
- Response shapes are normalised types from `src/lib/types.ts` (user data: `src/lib/user-state.ts`).
- Per-user responses must use `jsonNoStore`; only user-independent market data may use `jsonOk`.
- Guard database failures: return a generic 500/503 message, log the error name and SQL message only (never the connection string, cookies or tokens).
- `/api/movers` is intentionally expensive (~7 batched quote calls). It is memoised for 8 minutes and uses `fetchQuotesPartial`; keep that behaviour.

## Tests

- Unit tests must not hit the network or a database. Mock `fetch`, `clearMemoCache()` between provider tests, and mock `@/lib/user-state-repo` (route tests) or `@/lib/db` (repo tests) instead of connecting to Neon.
- Playwright runs against a **production build** on port `3100` with `AUTH_SECRET=test-secret` and `GOOGLE_AUTH_MOCK=1`. Market APIs and `/api/user/state` are intercepted in `tests/e2e/helpers.ts`; the mock login, session and logout use the real route handlers. `mockMarketApi(page)` returns a handle (`seedFavorites`, `seedUserState`, `userState`) backed by an in-memory row.
- `serviceWorkers: "block"` is set because a controlling service worker bypasses `page.route()`.
- Screenshots/traces go to `test-results/` (gitignored). Do not commit generated artifacts.
- The login helper waits for the dashboard URL; if a test hangs on login, check the dev server build state first.

## Common tasks

- **Add a chart range:** update `RANGES` in `src/lib/ranges.ts` (id, Yahoo range/interval, TTL), the range label map in `src/components/stock/stock-view.tsx`, and `TRAILING_POINTS` in `src/lib/stockanalysis.ts` if the fallback should slice differently.
- **Add a data provider:** implement the adapter in `src/lib/`, return normalised types, map its identifiers through `src/lib/symbols.ts`, then add it to the relevant route chain (`/api/search`, `/api/chart`, `fetchQuoteChunk`, or the news adapters). Keep provider-native symbols out of the UI.
- **Chart fallback contract:** every `ChartPayload` must set `source`; degraded data must set `note` so the UI explains itself.
- **Add an index:** add it to `MARKET_INDICES` in `src/lib/universe.ts` and, if CNBC should cover it, to `INDEX_TO_CNBC` in `src/lib/cnbc.ts`.
- **Change movers coverage:** edit `MOVERS_UNIVERSE`; keep the list at a size that respects Yahoo's 20-symbol batches and the 60 s function limit.
- **Swap data provider:** implement the adapter in `src/lib/` returning normalised types, then call it from the route handlers. Do not change component contracts.
- **Add persisted user data:** add the field to `UserState` in `src/lib/user-state.ts`, normalise it in `parseUserState`, bound it in `user-state-schema.ts`, add the column/JSON key in `db/schema.sql` + `user-state-repo.ts`, then read/write it in `snapshotUserState`/`applyUserState`. Bump `USER_STATE_VERSION` if the shape changes. Update `/privacy` when what you store changes.
- **Add another auth method:** issue the same `sg_session` payload (with a verified email) through `createSessionToken`. The middleware does not need to know the provider.
- **Change the Google policy:** the domain allowlist lives in `googleAuthConfig()` (`GOOGLE_ALLOWED_DOMAIN`, default `gmail.com`); email verification happens in the callback. Do not trust a client-supplied email.
- **Data practices change:** update `src/app/privacy/page.tsx` (and its "Last updated" date) whenever collection, processors, cookies or retention change. It is the URL submitted to Google.
- **Icons:** `public/icons/icon.svg` is the full logo (app icons + `src/app/icon.png`); `emblem.svg` is the wordmark-free mark used in the UI; the maskable and Apple touch variants are composed from `icon.svg` on a full-bleed square. Edit the SVGs, then `npm run icons`.

## Do not

- Add tables, columns or server state for anything other than per-user favourites, preferences and recent searches.
- Cache `/api/user/state`, memoize per-user data, or service-worker-cache API responses.
- Read `AUTH_PASSWORD` or reintroduce the password gate.
- Trust a client-supplied identity (email, user id, workspace).
- Hardcode provider keys, secrets or connection strings.
- Log `DATABASE_URL`, cookies or OAuth tokens.
- Commit `.env.local`, `.next`, `test-results`, `node_modules`.
- Bypass `memoize`/CDN caching to "make data fresher"; free providers will throttle.
- Introduce a second styling system or rewrite the design tokens ad hoc.

## Deployment

Vercel detects Next.js automatically. Provision Neon from **Storage**, set the Google OAuth variables, rebuild after changing any auth variable, create the table once (`db/schema.sql` in Neon's SQL editor, or `npm run db:migrate` with the unpooled URL), and deploy. No cron jobs or other storage provisioning are required.
