/**
 * Validation for `PUT /api/user/state`.
 *
 * Zod rejects structurally invalid or oversized payloads; the normalisers in
 * `user-state.ts` then apply canonical defaults (symbol fallback name, unknown
 * quote types, missing timestamps). Bounds come from the shared constants so the
 * client cache, the API and the database limit agree.
 */

import { z } from "zod";

import {
  DISPLAY_CURRENCIES,
  MAX_FAVORITES,
  QUOTE_TYPES,
  RECENT_SEARCH_LIMIT,
  THEMES,
  type Theme,
  type UserState,
} from "@/lib/user-state";
import type { DisplayCurrency } from "@/lib/fx";
import type { QuoteType } from "@/lib/types";

const quoteType = z.enum([...QUOTE_TYPES] as [QuoteType, ...QuoteType[]]);
const theme = z.enum([...THEMES] as [Theme, ...Theme[]]);
const displayCurrency = z.enum([...DISPLAY_CURRENCIES] as [DisplayCurrency, ...DisplayCurrency[]]);

const favorite = z.object({
  symbol: z.string().trim().min(1).max(32),
  name: z.string().trim().max(200).optional(),
  exchange: z.string().trim().max(64).nullable().optional(),
  quoteType: quoteType.optional(),
  addedAt: z.number().int().nonnegative().optional(),
});

const recentSearch = z.object({
  symbol: z.string().trim().min(1).max(32),
  name: z.string().trim().max(200).optional(),
  exchangeName: z.string().trim().max(64).nullable().optional(),
  quoteType: quoteType.optional(),
});

export const userStateSchema = z.object({
  // Whole-document writes only: a partial payload must not blank the row.
  favorites: z.array(favorite).max(MAX_FAVORITES),
  preferences: z
    .object({
      theme: theme.optional(),
      displayCurrency: displayCurrency.optional(),
    })
    .default({}),
  recentSearches: z.array(recentSearch).max(RECENT_SEARCH_LIMIT),
});

/** Validated, structurally bounded payload. Callers still run `parseUserState`. */
export type UserStatePayload = z.infer<typeof userStateSchema> & UserState;
