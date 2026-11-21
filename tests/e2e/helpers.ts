import type { Page, Route } from "@playwright/test";

/**
 * Deterministic market data for end-to-end tests.
 * The auth endpoints are left to the real dev server so login is exercised for real.
 */

const NOW = Math.floor(Date.now() / 1000);

const SPARK: Record<string, number[]> = {
  AAPL: [336, 338, 337, 340, 339, 341, 340.5, 342, 341.2, 342.56],
  MSFT: [500, 498, 497, 495, 496, 492, 490, 488, 486, 484.52],
  NVDA: [200, 198, 199, 195, 193, 190, 188, 185, 183, 180],
  "TEF.MC": [3.3, 3.31, 3.33, 3.32, 3.34, 3.35, 3.34, 3.36, 3.35, 3.36],
  "^IXIC": [23900, 23800, 23750, 23600, 23500, 23400, 23300, 23000, 22800, 22617.73],
};

const BASE_QUOTE = {
  previousClose: 100,
  change: 1,
  changePercent: 1,
  currency: "USD",
  exchange: "NMS",
  exchangeName: "NasdaqGS",
  quoteType: "EQUITY",
  marketState: "OPEN",
  dayHigh: 105,
  dayLow: 99,
  fiftyTwoWeekHigh: 360.83,
  fiftyTwoWeekLow: 243.42,
  volume: 80_568_107,
  asOf: NOW - 120,
  timezone: "America/New_York",
};

const QUOTES: Record<string, Record<string, unknown>> = {
  AAPL: {
    name: "Apple Inc.",
    price: 342.56,
    previousClose: 336.32,
    change: 6.24,
    changePercent: 1.86,
  },
  MSFT: {
    name: "Microsoft Corporation",
    price: 484.52,
    previousClose: 498.32,
    change: -13.8,
    changePercent: -2.77,
  },
  NVDA: {
    name: "NVIDIA Corporation",
    price: 180,
    previousClose: 194,
    change: -14,
    changePercent: -7.22,
  },
  "TEF.MC": {
    name: "Telefónica, S.A.",
    price: 3.36,
    previousClose: 3.35,
    change: 0.01,
    changePercent: 0.21,
    currency: "EUR",
    exchange: "MCE",
    exchangeName: "Madrid Stock Exchange",
    fiftyTwoWeekHigh: 4.12,
    fiftyTwoWeekLow: 3.13,
  },
  "^IXIC": {
    name: "Nasdaq Composite",
    price: 22617.73,
    previousClose: 23879.19,
    change: -1261.46,
    changePercent: -5.28,
    currency: null,
    exchange: "NMS",
    exchangeName: "NASDAQ",
    quoteType: "INDEX",
  },
  "^GSPC": {
    name: "S&P 500",
    price: 6910.39,
    previousClose: 7175.83,
    change: -265.44,
    changePercent: -3.7,
    currency: null,
    exchange: "INDEX",
    exchangeName: "INDEX",
    quoteType: "INDEX",
  },
  "^IBEX": {
    name: "IBEX 35",
    price: 18873.1,
    previousClose: 19186.2,
    change: -313.1,
    changePercent: -1.63,
    currency: null,
    exchange: "INDEX",
    exchangeName: "INDEX",
    quoteType: "INDEX",
  },
  "^N225": {
    name: "Nikkei 225",
    price: 56436.65,
    previousClose: 59445.2,
    change: -3008.55,
    changePercent: -5.06,
    currency: null,
    exchange: "INDEX",
    exchangeName: "INDEX",
    quoteType: "INDEX",
  },
};

export function quoteFor(symbol: string) {
  const data = QUOTES[symbol];
  if (!data) {
    return {
      ...BASE_QUOTE,
      symbol,
      name: symbol,
      price: 100,
      sparkline: [],
    };
  }
  return {
    ...BASE_QUOTE,
    ...data,
    symbol,
    sparkline: SPARK[symbol] ?? [],
  };
}

const SEARCH_CATALOG = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NMS",
    exchangeName: "NASDAQ",
    quoteType: "EQUITY",
    sector: "Technology",
    industry: "Consumer Electronics",
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    exchange: "NMS",
    exchangeName: "NASDAQ",
    quoteType: "EQUITY",
    sector: "Technology",
    industry: "Software",
  },
  {
    symbol: "TEF.MC",
    name: "Telefónica, S.A.",
    exchange: "MCE",
    exchangeName: "Madrid Stock Exchange",
    quoteType: "EQUITY",
    sector: "Communication Services",
    industry: "Telecom Services",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    exchange: "NMS",
    exchangeName: "NASDAQ",
    quoteType: "EQUITY",
    sector: "Technology",
    industry: "Semiconductors",
  },
  {
    symbol: "^IXIC",
    name: "Nasdaq Composite",
    exchange: "NMS",
    exchangeName: "NASDAQ GIDS",
    quoteType: "INDEX",
    sector: null,
    industry: null,
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const NEWS = [
  {
    id: "n1",
    title: "Apple unveils new chips at its developer event",
    publisher: "Reuters",
    link: "https://example.com/apple-chips",
    publishedAt: NOW - 300,
    tickers: ["AAPL"],
  },
  {
    id: "n2",
    title: "Telefónica raises full-year guidance",
    publisher: "Bloomberg",
    link: "https://example.com/telefonica-guidance",
    publishedAt: NOW - 900,
    tickers: ["TEF.MC"],
  },
  {
    id: "n3",
    title: "Markets slide as bond yields climb",
    publisher: "Financial Times",
    link: "https://example.com/markets-slide",
    publishedAt: NOW - 1800,
    tickers: [],
  },
  {
    id: "n4",
    title: "Nvidia slips on supply-chain concerns",
    publisher: "CNBC",
    link: "https://example.com/nvidia-supply",
    publishedAt: NOW - 2400,
    tickers: ["NVDA"],
  },
  {
    id: "n5",
    title: "Tech megacaps drag Wall Street lower",
    publisher: "MarketWatch",
    link: "https://example.com/tech-lower",
    publishedAt: NOW - 3600,
    tickers: ["AAPL", "MSFT"],
  },
];

const CHART_BASE: Record<string, number> = {
  AAPL: 336,
  MSFT: 498,
  NVDA: 194,
  "TEF.MC": 3.35,
};

function chartFor(symbol: string, range: string) {
  const points = 60;
  const first = CHART_BASE[symbol] ?? 100;
  const step = range === "1D" || range === "1W" ? 300 : 86_400;
  const amplitude = first * 0.012;
  const series = Array.from({ length: points }, (_, index) => ({
    time: 1_700_000_000 + index * step,
    value: Math.round((first + Math.sin(index / 5) * amplitude + index * amplitude * 0.05) * 100) / 100,
  }));
  const last = series[series.length - 1].value;
  return {
    symbol,
    currency: symbol === "TEF.MC" ? "EUR" : "USD",
    exchangeName: "Yahoo exchange",
    timezone: "America/New_York",
    offset: -18_000,
    range,
    interval: range === "1D" ? "5m" : "1d",
    intraday: range === "1D" || range === "1W",
    baseline: first,
    performance: (last - first) / first,
    series,
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function mockMarketApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    // Let the real auth endpoints run.
    if (path.startsWith("/api/auth/login") || path.startsWith("/api/auth/logout")) {
      return route.fallback();
    }
    if (path === "/api/auth/session") {
      return fulfillJson(route, { required: true, authenticated: true });
    }

    if (path === "/api/quotes") {
      const symbols = (url.searchParams.get("symbols") ?? "").split(",").filter(Boolean);
      return fulfillJson(route, {
        quotes: symbols.map(quoteFor),
        fetchedAt: Date.now(),
      });
    }

    if (path === "/api/chart") {
      const symbol = url.searchParams.get("symbol") ?? "AAPL";
      const range = url.searchParams.get("range") ?? "1D";
      return fulfillJson(route, chartFor(symbol, range));
    }

    if (path === "/api/search") {
      const query = normalize(url.searchParams.get("q") ?? "");
      const results = SEARCH_CATALOG.filter(
        (item) => normalize(item.symbol).includes(query) || normalize(item.name).includes(query),
      );
      return fulfillJson(route, { query, results, fetchedAt: Date.now() });
    }

    if (path === "/api/news") {
      return fulfillJson(route, { items: NEWS, symbols: [], fetchedAt: Date.now() });
    }

    if (path === "/api/markets") {
      const symbols = ["^GSPC", "^IXIC", "^IBEX", "^N225"];
      return fulfillJson(route, {
        indices: symbols.map(quoteFor),
        asOf: NOW,
      });
    }

    if (path === "/api/movers") {
      return fulfillJson(route, {
        gainers: [quoteFor("TEF.MC"), quoteFor("AAPL")],
        losers: [quoteFor("NVDA"), quoteFor("MSFT")],
        asOf: NOW,
        universe: 136,
        partial: false,
      });
    }

    if (path === "/api/fx") {
      return fulfillJson(route, {
        base: "EUR",
        rates: { EUR: 1, USD: 1.1, GBP: 0.84, JPY: 170, HKD: 8.6, KRW: 1460, TWD: 36 },
        asOf: new Date().toISOString().slice(0, 10),
        missing: [],
      });
    }

    return fulfillJson(route, { error: "not mocked" }, 404);
  });
}

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Shared password").fill("test-pass");
  await page.getByRole("button", { name: "Enter dashboard" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 45_000 });
}

export const FAVORITES_SEED = {
  state: {
    favorites: [
      { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", quoteType: "EQUITY", addedAt: NOW * 1000 - 5000 },
      { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", quoteType: "EQUITY", addedAt: NOW * 1000 - 4000 },
    ],
  },
  version: 1,
};

export async function seedFavorites(page: Page) {
  await page.addInitScript((payload) => {
    if (!window.localStorage.getItem("sg:favorites:v1")) {
      window.localStorage.setItem("sg:favorites:v1", payload);
    }
  }, JSON.stringify(FAVORITES_SEED));
}
