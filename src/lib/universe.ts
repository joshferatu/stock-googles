/**
 * Curated market universe for the movers module.
 *
 * Yahoo's screener endpoints are not publicly reachable, so "biggest movers"
 * is computed over this fixed, globally spread set of liquid names instead of
 * the whole market. ~120 symbols => 6 batched quote requests (20 per request).
 */

export interface IndexDefinition {
  symbol: string;
  label: string;
  region: string;
}

export const MARKET_INDICES: IndexDefinition[] = [
  { symbol: "^GSPC", label: "S&P 500", region: "US" },
  { symbol: "^IXIC", label: "Nasdaq", region: "US" },
  { symbol: "^DJI", label: "Dow Jones", region: "US" },
  { symbol: "^GDAXI", label: "DAX", region: "DE" },
  { symbol: "^IBEX", label: "IBEX 35", region: "ES" },
  { symbol: "^FTSE", label: "FTSE 100", region: "UK" },
  { symbol: "^FCHI", label: "CAC 40", region: "FR" },
  { symbol: "^STOXX50E", label: "Euro Stoxx 50", region: "EU" },
  { symbol: "^N225", label: "Nikkei 225", region: "JP" },
  { symbol: "^HSI", label: "Hang Seng", region: "HK" },
];

export const MOVERS_UNIVERSE: string[] = [
  // United States
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "JPM", "V",
  "UNH", "XOM", "LLY", "JNJ", "MA", "AVGO", "PG", "HD", "MRK", "COST",
  "ABBV", "CVX", "PEP", "KO", "ADBE", "WMT", "CRM", "MCD", "TMO", "ACN",
  "LIN", "ABT", "DHR", "NKE", "TXN", "PM", "NEE", "ORCL", "DIS", "WFC",
  "UPS", "BA", "IBM", "GE", "CAT", "GS", "AMGN", "SBUX", "BLK", "AXP",
  "GILD", "ADP", "TJX", "VRTX", "C", "LMT", "SYK", "PLD", "AMD", "INTC",
  "QCOM", "MU", "PYPL", "NFLX", "BKNG", "UBER", "SHOP", "COIN", "PLTR", "CRWD",
  // Europe
  "TEF.MC", "SAN.MC", "ITX.MC", "IBE.MC", "BBVA.MC", "REP.MC",
  "AIR.PA", "MC.PA", "OR.PA", "SAN.PA", "BNP.PA", "AI.PA", "SU.PA", "TTE.PA",
  "SIE.DE", "BMW.DE", "MBG.DE", "ALV.DE", "BAS.DE", "BAYN.DE", "ADS.DE", "DTE.DE",
  "ENEL.MI", "ENI.MI", "ISP.MI", "UCG.MI", "RACE.MI",
  "NESN.SW", "ROG.SW", "NOVN.SW", "UBSG.SW", "ZURN.SW",
  "ASML.AS", "AD.AS", "PHIA.AS", "HEIA.AS", "INGA.AS", "ABI.BR", "NOVO-B.CO",
  // Asia-Pacific & South America
  "7203.T", "6758.T", "9984.T", "8306.T", "6861.T", "9432.T",
  "0700.HK", "9988.HK", "0939.HK", "1299.HK", "2318.HK",
  "005930.KS", "000660.KS", "2330.TW", "2454.TW",
  "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS",
  "BHP.AX", "CBA.AX", "CSL.AX", "NAB.AX", "WBC.AX",
  "VALE3.SA", "PETR4.SA", "ITUB4.SA",
];

/** Symbols suggested in empty states and the search palette. */
export const POPULAR_SYMBOLS = ["AAPL", "MSFT", "NVDA", "GOOGL", "TSLA", "TEF.MC", "^IXIC", "^IBEX"];

export const YAHOO_SPARK_BATCH_SIZE = 20;
