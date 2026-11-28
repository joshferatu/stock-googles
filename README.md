# Stock Googles

A fast, installable market dashboard for a handful of people. Search any listed company or index worldwide, follow favourites, and see what moved today — Google sign-in for identity, a Neon Postgres row per account for favourites, and no paid market-data APIs.

![Next.js](https://img.shields.io/badge/Next.js-15-000?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss)
![Deploy](https://img.shields.io/badge/Vercel-ready-000?logo=vercel)

## What it does

- **Dashboard first** — your watchlist summary, biggest gainers/losers, index strip and news.
- **Global search** — companies, ETFs and indices from every major exchange (`AAPL`, `TEF.MC`, `^IXIC`, `0700.HK`, …), with a ⌘K command palette and recent searches.
- **Detail view** — intraday-to-all-time area chart, live quote, day/52-week ranges, volume, sector, and ticker news.
- **Favourites** — optimistic star buttons in search, detail and movers; saved to your account in Postgres, so they follow you between browsers and devices, with a local cache for instant paint and offline reads. Managed from a dedicated page with sorting, JSON export/import and clear.
- **Personalised news** — "For you" mixes headlines for your favourites with market-wide stories.
- **Currency display** — native, EUR or USD, converted with daily reference rates.
- **Native-feeling UX** — no full reloads, skeletons, hover prefetch, background refresh, a persisted query cache and an installable PWA.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router, TypeScript) | Server route handlers double as the API proxy; deploys with zero config on Vercel. |
| UI | Tailwind CSS v4, shadcn-style local components, `lucide-react` | Small bundle, dark/light theming, no component-library weight. |
| Data fetching | TanStack Query v5 + `localStorage` persister | Cache-sharing, background revalidation, instant reloads, prefetching. |
| Charts | TradingView `lightweight-charts` v5 | Canvas performance and a native finance feel. |
| State | Zustand (favourites, settings, toasts) | Tiny, hydrated synchronously from `localStorage` as a cache of the database. |
| Database | Neon Postgres via `@neondatabase/serverless` | Per-user favourites, preferences and recent searches; HTTP driver, no TCP pool to exhaust. |
| Validation | Zod | Route input validation. |
| Market data | Yahoo Finance, Jina reader proxy, StockAnalysis, TradingView, CNBC, Nasdaq, Google News RSS, open.er-api.com | All keyless. See [Data sources](#data-sources). |
| Tests | Vitest + Testing Library, Playwright | Unit/adapter coverage and browser smoke tests with mocked APIs. |

## Quick start

```bash
npm install
cp .env.example .env.local   # optional
# Paste DATABASE_URL (+ DATABASE_URL_UNPOOLED) from Vercel → Storage → Neon → .env.local.
# `vercel env pull` cannot download them: integration secrets are encrypted.
npm run db:migrate           # create the user_state table
npm run dev                  # http://localhost:3000
```

Google SSO is the only way in, so a working setup needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `AUTH_SECRET` (see [Authentication](#authentication-private-alpha)). For local work without a Google client, set `GOOGLE_AUTH_MOCK=1`. With no auth env vars the app stays open but `/api/user/state` returns 401 and data stays browser-local.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon pooled connection string, used at runtime. Injected by the Vercel Neon integration (Preview/Production only) as an encrypted variable, so copy it from the dashboard rather than `vercel env pull`. |
| `DATABASE_URL_UNPOOLED` | For migrations | Direct connection, used by `npm run db:migrate`. |
| `AUTH_SECRET` | Yes | HMAC key for signed cookies. Falls back to a value derived from the Google client secret. Generate with `openssl rand -base64 32`. |
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth client secret. |
| `GOOGLE_ALLOWED_DOMAIN` | No | Allowed Google account domain. Defaults to `gmail.com`. |
| `GOOGLE_AUTH_MOCK` | No | Local/E2E only: simulates Google without a client. Ignored on Vercel production. |
| `NEXT_PUBLIC_SITE_URL` | With SSO | Canonical origin; used for the OAuth redirect URI and Open Graph metadata. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Recommended | Shown as the privacy contact on `/privacy`; use the same address as the OAuth support email. |

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project** and import it. The defaults work (Next.js is detected, Node 20+).
3. Add the **Neon** integration in **Storage** (Vercel injects `DATABASE_URL` and the `PG*` variables into Preview and Production).
4. Add the auth variables in **Settings → Environment Variables**, then redeploy. Environment variables for Edge Middleware are read at build time, so set them before building.
5. Create the `user_state` table once: run `db/schema.sql` in Neon's SQL editor (Vercel → Storage → Open in Neon), or copy `DATABASE_URL_UNPOOLED` into `.env.local` and run `npm run db:migrate`.

The runtime requirements are outbound HTTPS requests to the market-data providers, Google's OAuth endpoints and open.er-api.com, plus Neon over HTTPS. No cron jobs, queues or other services are needed.

## Authentication (Private Alpha)

The app is labelled **Private Alpha — early access; data and features may change**. Google SSO is the only gate:

- **Google SSO** (`/login/google`) — authorization code + PKCE, verified email, gmail.com domain. Issues a 30-day session whose payload carries the verified email. `/login` forwards here so the OAuth client's registered home page keeps working.

There is no shared-password screen any more: an identity is required because favourites and preferences are stored per account.

Settings shows the signed-in email next to **Sign out**. Sign out clears local cookies only; it does not sign out of Google. Google SSO identifies the user; it does **not** fetch market data or use Google Finance.

### Create the Google OAuth client

There is no official shared client to reuse; each deployment needs its own OAuth 2.0 **Web application** client.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select a project.
2. **APIs & Services → OAuth consent screen**:
   - User type **External**, app name **Stock Googles**, support email, developer contact.
   - Scopes: `openid`, `email`, `profile` (non-sensitive).
   - Add the Gmail accounts as **test users** while testing, or **Publish app** to accept any Google account.
3. **Branding** (required to publish):
   - Application home page: `https://stock-googles.vercel.app/login`
   - Privacy policy: `https://stock-googles.vercel.app/privacy`
   - Authorized domain: `stock-googles.vercel.app`
   - App logo: `public/icons/icon-512.png`
   - Set `NEXT_PUBLIC_CONTACT_EMAIL` to the same address as the support email.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized JavaScript origins: `https://stock-googles.vercel.app` (optional for this server flow) and `http://localhost:3000`.
   - Authorized redirect URIs:
     - `https://stock-googles.vercel.app/api/auth/google/callback`
     - `http://localhost:3000/api/auth/google/callback`
5. Copy the **Client ID** and **Client secret** into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

> While the consent screen is in **Testing**, only listed test users can sign in. Publishing the app (with the non-sensitive scopes above) is what allows any `@gmail.com` account to sign in.

### Environment values

| Variable | Value |
| --- | --- |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `DATABASE_URL` | Injected by the Vercel Neon integration. |
| `GOOGLE_CLIENT_ID` | From the OAuth client. |
| `GOOGLE_CLIENT_SECRET` | From the OAuth client. Keep it out of git. |
| `GOOGLE_ALLOWED_DOMAIN` | `gmail.com` (default). |
| `NEXT_PUBLIC_SITE_URL` | `https://stock-googles.vercel.app` |
| `GOOGLE_AUTH_MOCK` | Leave unset in production. |

Set these in Vercel → **Settings → Environment Variables** and redeploy. Middleware env vars are read at build time.

The `/privacy` page is intentionally public (no Google session) so Google reviewers and visitors can read it. Set `NEXT_PUBLIC_CONTACT_EMAIL` to your support address; update the policy if the app's data practices change.

### Local development without a Google client

```bash
GOOGLE_AUTH_MOCK=1 npm run dev
```

`/login/google` then shows an email form instead of the Google popup. Only `@gmail.com` addresses pass. Mock mode is ignored when `VERCEL_ENV=production`, so it cannot weaken the Vercel deployment.

### Session details

- OAuth state + PKCE verifier: signed HttpOnly `sg_oauth`, 10 minutes, single-use.
- Session: signed HttpOnly `sg_session`, 30 days, contains the verified email.
- Tokens are HMAC-SHA256 and stateless. Sessions without an email are rejected, so legacy password-gate cookies no longer work.
- Logout clears both cookies locally; the database row is untouched.

## User data (Neon)

| Where | What |
| --- | --- |
| `db/schema.sql` | `user_state` table: `user_id` (verified email) plus `favorites`, `preferences`, `recent_searches` JSONB and `updated_at`. |
| `src/app/api/user/state` | `GET` returns the document (`exists: false` when no row yet); `PUT` upserts it. Both `no-store`, both require a session. |
| `src/lib/user-state-repo.ts` | SQL reads/writes; JSON columns are normalised on the way out. |
| `src/lib/user-state-sync.tsx` | Debounced write-through from the Zustand stores, plus boot-time reconciliation. |

The database is the source of truth; `localStorage` is a cache. On boot the client does one `GET`:

- no row yet, but the browser has data → the local copy is pushed (first run after the localStorage era);
- a previous write failed (`sg:user-state:pending:v1` flag) → the local copy is pushed;
- otherwise → the server document is applied to the stores.

Writes are debounced 600 ms, last-write-wins between devices, and retried on the next change or on `online`. A failed save leaves the local copy intact, so the app keeps working offline.

## Data sources

| Purpose | Provider chain (first success wins) | Notes |
| --- | --- | --- |
| Search | Yahoo → **StockAnalysis** → **TradingView** → **Nasdaq** | Yahoo gives rich metadata; StockAnalysis covers global listings; TradingView adds broad exchange coverage; Nasdaq is a US-only last resort. |
| Charts | Yahoo → **StockAnalysis** | StockAnalysis only serves US daily bars on its free endpoint; intraday and international charts stay on Yahoo. Fallback charts carry a visible "daily closes" note. |
| Quotes | Yahoo → **CNBC** → **TradingView** | Batched 20 symbols/request. CNBC covers most exchange suffixes; TradingView's scanner fills any gaps. |
| News | Yahoo → **Google News RSS** | Per-ticker and market-wide; deduped by URL. RSS is used when Yahoo's news endpoint is throttled. |
| Yahoo transport | Direct `query1/query2.finance.yahoo.com` → **`r.jina.ai` reader proxy** | Yahoo throttles cloud egress IPs (HTTP 429). The proxy fetches the same Yahoo JSON from a different network; it is free and limited to ~20 requests/minute. |
| FX | open.er-api.com → Frankfurter | Daily reference rates, cached for six hours. |

**Caveats, stated plainly:**

- All providers are **unofficial public endpoints**. They can change, rate-limit or block cloud IPs. The app tries multiple providers and caches aggressively, but no free provider offers an SLA.
- Yahoo often blocks Vercel's shared egress IPs with HTTP 429. The app detects this and routes the same Yahoo endpoints through the free `r.jina.ai` reader proxy. If the proxy also fails, search falls back to StockAnalysis/TradingView/Nasdaq and charts fall back to StockAnalysis daily closes.
- The fallbacks are not feature-identical: StockAnalysis has no intraday bars and only US history; TradingView quotes have no sparkline or day/52-week ranges; Google News headlines are less curated than Yahoo's.
- Quotes are typically delayed **15–20 minutes** depending on the exchange. There is no real-time or websocket feed.
- The movers module scans a fixed universe of ~136 liquid names (`src/lib/universe.ts`) because Yahoo's screener endpoints are not publicly reachable.
- News coverage follows Yahoo's editorial coverage and is not exhaustive.

If you want a paid, SLA-backed provider later, replace the functions in `src/lib/yahoo.ts` and `src/lib/cnbc.ts`; routes and components consume normalised types from `src/lib/types.ts`.

## Architecture

```
src/
  app/
    (app)/                 # authenticated shell + pages
      page.tsx             # dashboard
      favorites/           # watchlist management
      search/              # global search page
      stock/[symbol]/      # detail view
    api/                   # thin proxy routes (search, quotes, chart, news, movers, markets, fx, auth, user/state)
    login/                 # Google SSO entry
    offline/               # PWA offline fallback
  components/              # dashboard, stock, search, settings, UI primitives
  lib/
    db.ts                  # Neon HTTP client (lazy, fails closed)
    user-state.ts          # shared user-state types, limits and normalisers
    user-state-repo.ts     # user_state SQL reads/writes
    user-state-sync.tsx    # store <-> API write-through
    yahoo.ts               # primary provider adapter + normalisation
    cnbc.ts                # keyless quote fallback
    cache.ts               # in-process TTL cache, coalescing, stale-on-error
    queries.ts             # TanStack Query hooks + currency formatting
    favorites-store.ts     # persisted watchlist
    settings-store.ts      # theme + display currency
    session.ts             # HMAC session tokens (edge-safe)
  middleware.ts            # Google-session gate
```

### Caching layers

1. **Browser query cache** — TanStack Query persists successful queries to `localStorage` for 24 h, so a reload paints the last known prices immediately and then revalidates. Successful fallback responses are cached just like Yahoo responses.
2. **In-flight coalescing** — identical concurrent upstream calls share one request (`src/lib/cache.ts`).
3. **Server memory TTL** — quotes 30 s, charts 30 s–30 min depending on range, news 5 min, movers 8 min, FX 6 h.
4. **CDN** — every API response sends `s-maxage` + `stale-while-revalidate`, so Vercel's edge absorbs repeat traffic.
5. **Service worker** — cache-first static assets and an offline navigation fallback. API responses are intentionally never cached by the SW (the app's own query cache handles offline reads).

Favourites are written to the Zustand store (and `localStorage`) synchronously, so the star never waits for the network; the debounced `PUT /api/user/state` and the quote refetch follow in the background. Per-user state is deliberately excluded from the persisted query cache and from CDN caching.

## API routes

| Route | Query | Cache |
| --- | --- | --- |
| `GET /api/search` | `q` | 2 min |
| `GET /api/quotes` | `symbols` (comma separated, max 40) | 30 s |
| `GET /api/chart` | `symbol`, `range=1D\|1W\|1M\|6M\|1Y\|5Y\|MAX` | 30 s–30 min |
| `GET /api/news` | `symbols?`, `market=1`, `limit` | 5 min |
| `GET /api/movers` | — | 5 min edge / 8 min memory |
| `GET /api/markets` | — | 60 s |
| `GET /api/fx` | — | 1 h |
| `GET \| PUT /api/user/state` | session cookie | no-store (per user) |
| `POST /api/auth/logout`, `GET /api/auth/session` | — | no-store |
| `GET /api/auth/google/start`, `GET /api/auth/google/callback`, `POST /api/auth/google/mock` | OAuth code/state | no-store |

All market routes validate input with Zod and return `{ error }` with an appropriate status on failure.

## Tests

```bash
npm test            # Vitest unit tests (adapters, formats, session, user state, cache, store)
npm run test:e2e    # Playwright smoke tests (mocked market APIs + user state, real auth)
npm run typecheck
npm run lint
```

Playwright needs Chromium (`npx playwright install chromium`, or `--with-deps` on Linux CI). The e2e suite builds the app, starts a production server on port `3100` with `AUTH_SECRET=test-secret` and `GOOGLE_AUTH_MOCK=1`, blocks service workers, intercepts market APIs and stubs `/api/user/state` with an in-memory row (no database needed). The login helper completes the Google mock gate.

## Project notes

- **One writer per working tree** is assumed; favourites are per Google account and follow the user across devices.
- The movers universe, range definitions and cache TTLs are the main tuning knobs (`src/lib/universe.ts`, `src/lib/ranges.ts`).
- `npm run icons` regenerates PWA icons from `public/icons/*.svg`.
- Not investment advice. Data is provided for information only.
