"use client";

import Link from "next/link";
import { Star } from "lucide-react";

import { useFavorites } from "@/lib/favorites-store";
import type { FavoriteInput } from "@/lib/favorites-store";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/utils";

/**
 * Optimistic star: persisted synchronously to localStorage, so it feels instant
 * and survives a reload even when the API is slow.
 */
export function FavoriteButton({
  favorite,
  size = "md",
  withLabel = false,
  className,
}: {
  favorite: FavoriteInput;
  size?: "sm" | "md" | "lg";
  withLabel?: boolean;
  className?: string;
}) {
  const favorites = useFavorites((state) => state.favorites);
  const toggleFavorite = useFavorites((state) => state.toggleFavorite);
  const isFavorite = favorites.some((item) => item.symbol === favorite.symbol);

  const iconSize = size === "sm" ? "size-3.5" : size === "lg" ? "size-5" : "size-4";
  const boxSize = size === "sm" ? "size-7" : size === "lg" ? "size-11" : "size-9";

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remove ${favorite.symbol} from favourites` : `Add ${favorite.symbol} to favourites`}
      title={isFavorite ? "Remove from favourites" : "Add to favourites"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(favorite);
        toast(
          isFavorite ? `${favorite.symbol} removed from favourites` : `${favorite.symbol} added to favourites`,
          isFavorite ? "default" : "success",
        );
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border transition-all duration-150 active:scale-90",
        boxSize,
        isFavorite
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-border text-muted hover:border-border-strong hover:text-fg",
        withLabel && "w-auto px-3",
        className,
      )}
    >
      <Star className={cn(iconSize, isFavorite && "fill-current")} />
      {withLabel ? (
        <span className="text-xs font-medium">{isFavorite ? "Following" : "Follow"}</span>
      ) : null}
    </button>
  );
}

export function EmptyFavoritesHint() {
  return (
    <Link
      href="/search"
      className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/15"
    >
      Find companies
    </Link>
  );
}
