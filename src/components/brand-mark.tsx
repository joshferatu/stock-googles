import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * The in-app logo mark. Uses the emblem-only variant: the wordmark on
 * icon.svg is unreadable at header size and stays on the app icons.
 */
export function BrandMark({
  className,
  alt = "Stock Googles",
  priority = false,
}: {
  className?: string;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/icons/emblem.svg"
      alt={alt}
      width={96}
      height={96}
      unoptimized
      priority={priority}
      className={cn("size-9 shrink-0 select-none", className)}
    />
  );
}
