# AGENTS.md

Guidance for AI coding agents working in this repository. Read it before changing code.

## What this project is

**Stock Googles** is a single-tenant market dashboard deployed on Vercel. It lets a small group of users search global listings, follow companies, and see a personalised market overview.

Hard constraints:

- **No database.** All user state (favourites, settings, cached quotes) lives in the browser (`localStorage`).
- **Keyless public APIs with a provider chain.** Yahoo Finance is primary; StockAnalysis, TradingView, CNBC, Nasdaq, Google News RSS and open.er-api.com provide fallbacks. No paid keys.
- **Thin server.** Next.js route handlers only proxy and normalise upstream data. There is no server-side user state or session store.
- **Vercel-first.** No cron jobs, background workers, message queues or extra services.

## Quick commands

```bash
npm run dev         # local dev server, http://localhost:3000
npm run build       # production build
npm run start       # serve the production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm test            # Vitest unit tests
npm run test:e2e    # Playwright (builds, starts :3100, mocks market APIs)
npm run icons       # regenerate PWA PNGs from public/icons/*.svg
```

Never run `next dev` and `next start` at the same time: they share `.next` and corrupt each other's chunks. Stop one before starting the other.

## Environment variables

| Variable | Effect |
| --- | --- |
| `AUTH_PASSWORD` | First gate: shared password. Empty/unset = no password screen. |
| `AUTH_SECRET` | HMAC key for signed cookies; falls back to a value derived from the password. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Enable the second gate (Google OIDC). Both are required. |
| `GOOGLE_ALLOWED_DOMAIN` | Allowed Google email domain. Defaults to `gmail.com`. |
| `GOOGLE_AUTH_MOCK` | Local/E2E only; simulates Google. Ignored when `VERCEL_ENV=production`. |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin; builds the OAuth redirect URI and Open Graph metadata. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Privacy contact shown on the public `/privacy` page. |

`middleware.ts` reads auth env at **build time** (Edge runtime inlining). Changing these variables requires a rebuild/redeploy. The login route reads them at runtime.

## Architecture

```
src/app/
  (app)/                  authenticated shell and pages: dashboard, favorites,
                          search, stock/[symbol]
  api/                    proxy routes: search, quotes, chart, news, movers,
                          markets, fx, auth/{login,logout,session}
  login/                  password gate + Google step (outside the app shell)
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
  favorites-store.ts      Zustand + persist (localStorage)
  settings-store.ts       theme + display currency (localStorage)
  session.ts              signed session/gate/OAuth tokens; Web Crypto only (edge-safe)
  google.ts               Google OIDC helpers (auth URL, token exchange, userinfo)
  http.ts                 JSON response helpers + Cache-Control policy
  ranges.ts               chart range → Yahoo range/interval/TTL mapping
  universe.ts             index list + 136-symbol movers universe
src/middleware.ts         optional shared-password gate
tests/unit/               Vitest tests (adapters, formats, session, cache, store)
tests/e2e/                Playwright specs + deterministic mock fixtures
```

Data flow: browser → TanStack Query hook (`src/lib/queries.ts`) → `/api/*` route → provider chain → normalised types. Yahoo is attempted directly, then through the `r.jina.ai` reader proxy; each data type has additional fallbacks (see Provider notes). Routes respond with `jsonOk` (`s-maxage` + `stale-while-revalidate`).

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

1. Browser: TanStack Query persists successful queries to `localStorage` for 24 h (`Providers`), except `search` queries. Assets are cache-first in the service worker.
2. Server memory: `memoize(key, ttl, loader)` in `src/lib/cache.ts`; deduplicates concurrent loads and serves stale values for up to 6 h on failure.
3. CDN: route `Cache-Control` via `jsonOk` (`s-maxage`, `stale-while-revalidate`). Keep TTLs aligned with `src/lib/ranges.ts` and the route.
4. Service worker: static/navigation only. **API responses are intentionally not cached** because auth must stay live; browser query persistence covers offline reads.

## Auth (Private Alpha, two gates)

- **Stage 1 — shared password.** `POST /api/auth/login` checks `AUTH_PASSWORD`, rate-limits failures and sets a signed 15-minute `sg_gate` cookie. With SSO configured it must **not** issue a full session.
- **Stage 2 — Google OIDC.** `/login/google` → `/api/auth/google/start` (random state + PKCE S256, signed 10-minute `sg_oauth` cookie) → Google → `/api/auth/google/callback`. The callback exchanges the code, reads Google userinfo, requires `email_verified` and an address in `GOOGLE_ALLOWED_DOMAIN` (default `gmail.com`), then issues a 30-day `sg_session` containing the email.
- **Tokens:** `base64url(JSON).base64url(HMAC-SHA256)` with an `exp` claim. Full sessions carry `email` (null for password-only). Old `v1.*` cookies are intentionally invalid. Use `safeNextPath` for all redirects.
- **Middleware:** `open` → no auth; `password` → any valid session; `google`/`mock` → a session **with an email**. Public: `/login`, `/login/google`, `/privacy`, `/api/auth/*`, `/offline`, PWA assets. `/login/google` requires the gate when `AUTH_PASSWORD` is set. Keep `/privacy` public for Google OAuth branding review.
- **Settings/logout:** `/api/auth/session` returns `email`, `name`, `mode`, `sso`; Settings shows the email next to Sign out. Logout clears `sg_session`, `sg_gate` and `sg_oauth` locally; it does not sign out of Google.
- **Mock mode:** `GOOGLE_AUTH_MOCK=1` (local/E2E) turns `/login/google` into an email form and enables `/api/auth/google/mock`. `googleAuthConfig()` ignores it when `VERCEL_ENV=production`. Do not use it as a production login.
- **Identity only:** Google SSO never touches market data; do not add Google Finance/Sheets calls here.
- Never log or expose `AUTH_PASSWORD`, `AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, OAuth codes or session tokens. Keep PKCE and state verification intact.

## Frontend conventions

- **Persisted state hydration:** any markup that differs between server render and client hydration must be gated with `useHydrated()` (`src/lib/client-hooks.ts`). This applies to favourites, theme and anything read from `localStorage`.
- **Module-init ordering:** `persist` hydrates synchronously for `localStorage`, so constants used by `merge`/`parseFavorites` must be declared **above** the store. The previous TDZ bug made favourites silently disappear.
- **Favourites spelling:** the UI uses British "favourites" and the brand is "Stock Googles"; keep copy consistent.
- **Styling:** Tailwind v4 with CSS variables in `src/app/globals.css` (`--bg`, `--surface`, `--up`, `--down`, `--accent`, …). Use token utilities (`bg-surface`, `text-muted`, `text-up`) rather than raw hex values. Charts read these variables via `getComputedStyle`.
- **Components:** shadcn-style local components live in `src/components/ui/`; no component library runtime. Prefer `cn()` from `src/lib/utils.ts`.
- **Numbers:** use formatters from `src/lib/format.ts` (`en-US`, tabular numbers). Do not call `Intl` ad hoc.
- **Native feel:** keep route transitions client-side, add skeletons rather than layout jumps, prefetch on hover (`usePrefetchStock`), and keep the optimistic star behaviour.
- **Query keys** live in `queryKeys`; do not hand-write key arrays. `useQuotes` writes each quote into `["quote", symbol]` so detail pages reuse dashboard data.

## API route rules

- Every market route exports `dynamic = "force-dynamic"` and `runtime = "nodejs"` so nothing is fetched at build time.
- Validate input with Zod; return `jsonError(message, status)`.
- Map provider failures through `providerErrorMessage`; do not leak stack traces.
- Response shapes are normalised types from `src/lib/types.ts`.
- `/api/movers` is intentionally expensive (~7 batched quote calls). It is memoised for 8 minutes and uses `fetchQuotesPartial`; keep that behaviour.

## Tests

- Unit tests must not hit the network. Mock `fetch` and clear `clearMemoCache()` between provider tests.
- Playwright runs against a **production build** on port `3100` with `AUTH_PASSWORD=test-pass`, `AUTH_SECRET=test-secret` and `GOOGLE_AUTH_MOCK=1`. Market APIs are intercepted in `tests/e2e/helpers.ts`; password, mock Google, session and logout use the real route handlers. `login()` completes both gates.
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
- **Add persisted user preference:** use the Zustand persist pattern in `src/lib/settings-store.ts`, gate rendering with `useHydrated`, and bump the store version if the shape changes.
- **Change the Google policy:** the domain allowlist lives in `googleAuthConfig()` (`GOOGLE_ALLOWED_DOMAIN`, default `gmail.com`); email verification happens in the callback. Do not trust a client-supplied email.
- **Add another auth method:** issue the same `sg_session` payload through `createSessionToken` after verifying the identity; the middleware does not need to know the provider.
- **Data practices change:** update `src/app/privacy/page.tsx` (and its "Last updated" date) whenever collection, processors, cookies or retention change. It is the URL submitted to Google.
- **Icons:** `public/icons/icon.svg` is the full logo (app icons + `src/app/icon.png`); `emblem.svg` is the wordmark-free mark used in the UI; the maskable and Apple touch variants are composed from `icon.svg` on a full-bleed square. Edit the SVGs, then `npm run icons`.

## Do not

- Add a database or server-side user state.
- Cache `/api/auth/*` responses or service-worker-cache API responses.
- Hardcode provider keys or secrets.
- Commit `.env.local`, `.next`, `test-results`, `node_modules`.
- Bypass `memoize`/CDN caching to "make data fresher"; free providers will throttle.
- Introduce a second styling system or rewrite the design tokens ad hoc.

## Deployment

Vercel detects Next.js automatically. Set optional auth variables in project settings, rebuild after changing them, and deploy. No migrations, cron jobs or storage provisioning are required.
