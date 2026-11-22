/**
 * Provider symbol mapping helpers.
 *
 * Canonical symbols in this app stay Yahoo-style (`AAPL`, `TEF.MC`, `^IXIC`)
 * so search results, routes, favourites and deep links all share one format.
 * Each fallback provider gets a derived identifier from that canonical form.
 */

export interface MappedSymbol {
  symbol: string;
  exchangeName: string | null;
}

/** StockAnalysis exchange prefix → Yahoo symbol suffix. */
const SA_PREFIX_TO_SUFFIX: Record<string, string> = {
  bme: ".MC",
  mad: ".MC",
  etr: ".DE",
  fra: ".F",
  ham: ".HM",
  lon: ".L",
  par: ".PA",
  ams: ".AS",
  bru: ".BR",
  lis: ".LS",
  mil: ".MI",
  swx: ".SW",
  sto: ".ST",
  cph: ".CO",
  osl: ".OL",
  hel: ".HE",
  vie: ".VI",
  wse: ".WA",
  pra: ".PR",
  ath: ".AT",
  ist: ".IS",
  tyo: ".T",
  hkg: ".HK",
  krx: ".KS",
  tpe: ".TW",
  two: ".TWO",
  asx: ".AX",
  nse: ".NS",
  bom: ".BO",
  sha: ".SS",
  shz: ".SZ",
  bvmf: ".SA",
  mex: ".MX",
  tsx: ".TO",
  tor: ".TO",
  cve: ".V",
  otc: "",
  jse: ".JO",
  tase: ".TA",
};

const SA_PREFIX_TO_EXCHANGE: Record<string, string> = {
  bme: "Madrid",
  mad: "Madrid",
  etr: "XETRA",
  fra: "Frankfurt",
  ham: "Hamburg",
  lon: "London",
  par: "Paris",
  ams: "Amsterdam",
  bru: "Brussels",
  lis: "Lisbon",
  mil: "Milan",
  swx: "SIX",
  sto: "Stockholm",
  cph: "Copenhagen",
  osl: "Oslo",
  hel: "Helsinki",
  vie: "Vienna",
  wse: "Warsaw",
  pra: "Prague",
  ath: "Athens",
  ist: "Istanbul",
  tyo: "Tokyo",
  hkg: "Hong Kong",
  krx: "Korea",
  tpe: "Taiwan",
  two: "Taiwan OTC",
  asx: "ASX",
  nse: "NSE India",
  bom: "BSE India",
  sha: "Shanghai",
  shz: "Shenzhen",
  bvmf: "B3 Brazil",
  mex: "Mexico",
  tsx: "Toronto",
  tor: "Toronto",
  cve: "TSX Venture",
  otc: "OTC Markets",
  jse: "Johannesburg",
  tase: "Tel Aviv",
};

/** Yahoo symbol suffix → TradingView exchange code. */
const SUFFIX_TO_TV: Record<string, string> = {
  ".MC": "BME",
  ".DE": "XETR",
  ".F": "FWB",
  ".HM": "HAM",
  ".L": "LSE",
  ".PA": "EURONEXT",
  ".AS": "EURONEXT",
  ".BR": "EURONEXT",
  ".LS": "EURONEXT",
  ".MI": "MIL",
  ".SW": "SIX",
  ".ST": "OMXSTO",
  ".CO": "OMXCOP",
  ".OL": "OSL",
  ".HE": "OMXHEX",
  ".VI": "VIE",
  ".WA": "WSE",
  ".PR": "PSE",
  ".AT": "ATHEX",
  ".IS": "BIST",
  ".T": "TSE",
  ".HK": "HKEX",
  ".KS": "KRX",
  ".TW": "TWSE",
  ".TWO": "TPEX",
  ".AX": "ASX",
  ".NS": "NSE",
  ".BO": "BSE",
  ".SA": "BMFBOVESPA",
  ".MX": "BMV",
  ".TO": "TSX",
  ".V": "TSXV",
  ".JO": "JSE",
  ".TA": "TASE",
};

/**
 * TradingView exchange → Yahoo suffix.
 * `EURONEXT` is intentionally absent: it covers Paris, Amsterdam, Brussels and
 * Lisbon, so a canonical symbol cannot be derived reliably from it.
 */
const TV_EXCHANGE_TO_SUFFIX: Record<string, string> = {
  NASDAQ: "",
  NYSE: "",
  AMEX: "",
  OTC: "",
  BME: ".MC",
  XETR: ".DE",
  FWB: ".F",
  HAM: ".HM",
  LSE: ".L",
  MIL: ".MI",
  SIX: ".SW",
  OMXSTO: ".ST",
  OMXCOP: ".CO",
  OSL: ".OL",
  OMXHEX: ".HE",
  VIE: ".VI",
  WSE: ".WA",
  PSE: ".PR",
  ATHEX: ".AT",
  BIST: ".IS",
  TSE: ".T",
  HKEX: ".HK",
  KRX: ".KS",
  TWSE: ".TW",
  TPEX: ".TWO",
  ASX: ".AX",
  NSE: ".NS",
  BSE: ".BO",
  BMFBOVESPA: ".SA",
  BMV: ".MX",
  TSX: ".TO",
  TSXV: ".V",
  JSE: ".JO",
  TASE: ".TA",
};

export function saIdToSymbol(id: string): MappedSymbol | null {
  if (!id) return null;
  if (!id.includes("/")) {
    const symbol = id.trim().toUpperCase();
    return symbol ? { symbol, exchangeName: null } : null;
  }
  const [rawPrefix, ...rest] = id.split("/");
  const base = rest.join("/").trim();
  const prefix = rawPrefix.toLowerCase();
  const suffix = SA_PREFIX_TO_SUFFIX[prefix];
  if (!base || suffix === undefined) return null;
  return {
    symbol: `${base}${suffix}`,
    exchangeName: SA_PREFIX_TO_EXCHANGE[prefix] ?? prefix.toUpperCase(),
  };
}

/**
 * StockAnalysis only serves historical bars for US symbols on its free API.
 * International charts stay on the Yahoo direct/Jina path.
 */
export function deriveStockAnalysisId(symbol: string): string | null {
  if (!symbol || symbol.startsWith("^") || symbol.includes(".")) return null;
  return /^[A-Z0-9-]{1,12}$/.test(symbol) ? symbol : null;
}

export function deriveTradingViewTickers(symbol: string): string[] {
  if (!symbol || symbol.startsWith("^")) return [];
  if (!symbol.includes(".")) {
    return [`NASDAQ:${symbol}`, `NYSE:${symbol}`];
  }
  const index = symbol.lastIndexOf(".");
  const base = symbol.slice(0, index);
  const suffix = symbol.slice(index).toUpperCase();
  const exchange = SUFFIX_TO_TV[suffix];
  return exchange ? [`${exchange}:${base}`] : [];
}

/** `BRK.B` on TradingView is `BRK-B` on Yahoo. */
function usSymbolToYahoo(symbol: string): string {
  return /^[A-Z]{1,6}\.[A-Z]$/.test(symbol) ? symbol.replace(".", "-") : symbol;
}

export function tvSearchRowToSymbol(exchange: string, symbol: string): string | null {
  const normalizedExchange = exchange.trim().toUpperCase();
  const suffix = TV_EXCHANGE_TO_SUFFIX[normalizedExchange];
  if (suffix === undefined) return null;
  const base = symbol.trim();
  if (!base) return null;
  return suffix === "" ? usSymbolToYahoo(base) : `${base}${suffix}`;
}

export function stripTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
