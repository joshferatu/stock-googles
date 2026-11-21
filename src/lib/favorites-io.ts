"use client";

import { useFavorites, type Favorite } from "@/lib/favorites-store";

const MAX_IMPORT_BYTES = 512 * 1024;

export function exportFavoritesFile() {
  const favorites = useFavorites.getState().favorites;
  const payload = {
    app: "stock-googles",
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `stock-googles-favourites-${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return favorites.length;
}

/** Accepts both our export format and a plain array of favourites. */
export async function importFavoritesFile(file: File): Promise<number> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("That file is too large.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const items =
    Array.isArray(parsed) ? parsed : (parsed as { favorites?: unknown } | null)?.favorites;
  if (!Array.isArray(items)) throw new Error("No favourites found in that file.");
  const count = useFavorites.getState().importFavorites(items);
  if (count === 0) throw new Error("No valid favourites found in that file.");
  return count;
}

export function favoriteHref(favorite: Pick<Favorite, "symbol">) {
  return `/stock/${encodeURIComponent(favorite.symbol)}`;
}
