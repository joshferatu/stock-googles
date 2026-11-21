/** Minimal provider payloads, shaped like the real Yahoo/CNBC responses. */

export const sparkPayload = {
  spark: {
    result: [
      {
        symbol: "AAPL",
        response: [
          {
            meta: {
              currency: "USD",
              symbol: "AAPL",
              exchangeName: "NMS",
              fullExchangeName: "NasdaqGS",
              instrumentType: "EQUITY",
              regularMarketTime: 1_700_000_000,
              regularMarketPrice: 342.56,
              regularMarketChange: 6.24,
              regularMarketChangePercent: 1.8557,
              chartPreviousClose: 336.32,
              previousClose: 336.32,
              fiftyTwoWeekHigh: 360.83,
              fiftyTwoWeekLow: 243.42,
              regularMarketDayHigh: 354.34,
              regularMarketDayLow: 340.56,
              regularMarketVolume: 80_568_107,
              longName: "Apple Inc.",
              exchangeTimezoneName: "America/New_York",
              currentTradingPeriod: {
                pre: { start: 1_700_000_000, end: 1_700_010_000 },
                regular: { start: 1_700_010_000, end: 1_700_020_000 },
                post: { start: 1_700_020_000, end: 1_700_030_000 },
              },
            },
            timestamp: [1_700_000_000, 1_700_000_300, 1_700_000_600, 1_700_000_900],
            indicators: { quote: [{ close: [340, 342.56, null, 343.1] }] },
          },
        ],
      },
      {
        symbol: "^IXIC",
        response: [
          {
            meta: {
              currency: "USD",
              symbol: "^IXIC",
              exchangeName: "NMS",
              instrumentType: "INDEX",
              regularMarketPrice: 22_617.73,
              regularMarketChangePercent: -5.28,
              chartPreviousClose: 23_879.19,
              longName: "NASDAQ Composite",
              regularMarketTime: 1_700_000_000,
            },
            timestamp: [],
            indicators: { quote: [{ close: [] }] },
          },
        ],
      },
      {
        symbol: "BAD",
        response: [{ meta: { symbol: "BAD" } }],
      },
    ],
  },
};

export const chartPayload = {
  chart: {
    result: [
      {
        meta: {
          currency: "USD",
          symbol: "AAPL",
          exchangeName: "NMS",
          exchangeTimezoneName: "America/New_York",
          gmtoffset: -18_000,
          chartPreviousClose: 349.21,
          previousClose: 349.21,
          dataGranularity: "5m",
        },
        timestamp: [1_700_000_000, 1_700_000_300, 1_700_000_600],
        indicators: { quote: [{ close: [350.1, 351.2, 352.4] }] },
      },
    ],
  },
};

export const searchPayload = {
  quotes: [
    {
      symbol: "TEF.MC",
      longname: "Telefónica, S.A.",
      quoteType: "EQUITY",
      exchDisp: "Madrid Stock Exchange",
      exchange: "MCE",
      sectorDisp: "Communication Services",
      industryDisp: "Telecom Services",
      isYahooFinance: true,
    },
    {
      symbol: "TEF.MC",
      longname: "Duplicate",
      quoteType: "EQUITY",
      isYahooFinance: true,
    },
    {
      symbol: "NQ=F",
      shortname: "Nasdaq 100 Future",
      quoteType: "FUTURE",
    },
    {
      symbol: "BTC-USD",
      shortname: "Bitcoin",
      quoteType: "CRYPTOCURRENCY",
    },
    {
      symbol: "^IXIC",
      shortname: "Nasdaq Composite",
      quoteType: "INDEX",
      exchDisp: "NASDAQ GIDS",
    },
  ],
  news: [
    {
      uuid: "b",
      title: "Second story",
      publisher: "Reuters",
      link: "https://example.com/b",
      providerPublishTime: 200,
      relatedTickers: ["TEF.MC"],
    },
    {
      uuid: "a",
      title: "First story",
      publisher: "Bloomberg",
      link: "https://example.com/a",
      providerPublishTime: 300,
      relatedTickers: ["TEF.MC"],
    },
    {
      uuid: "a2",
      title: "Duplicate url",
      publisher: "Bloomberg",
      link: "https://example.com/a",
      providerPublishTime: 100,
    },
    {
      uuid: "c",
      title: "Broken link",
      publisher: "Spam",
      link: "javascript:alert(1)",
      providerPublishTime: 400,
    },
  ],
};

export const cnbcPayload = {
  FormattedQuoteResult: {
    FormattedQuote: [
      {
        symbol: "AAPL",
        code: 0,
        name: "Apple Inc.",
        last: "342.56",
        change: "-6.65",
        change_pct: "-1.90%",
        previous_day_closing: "349.21",
        currencyCode: "USD",
        exchange: "NASDAQ",
        type: "STOCK",
        high: "354.34",
        low: "340.56",
        volume: "69,422,613",
        yrhiprice: "360.83",
        yrloprice: "243.42",
        curmktstatus: "POST_MKT",
      },
      {
        symbol: ".IXIC",
        code: 0,
        name: "NASDAQ Composite",
        last: "22,617.733",
        change_pct: "-5.28%",
        previous_day_closing: "23,879.199",
        type: "INDEX",
        curmktstatus: "REG_MKT",
      },
      {
        symbol: "MISSING",
        code: 3,
      },
    ],
  },
};
