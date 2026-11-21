import { initials } from "@/lib/format";
import { cn, symbolGradient } from "@/lib/utils";

const sizes = {
  xs: "size-7 text-[9px] rounded-md",
  sm: "size-9 text-[10px] rounded-lg",
  md: "size-11 text-xs rounded-xl",
  lg: "size-14 text-sm rounded-2xl",
  xl: "size-16 text-base rounded-2xl",
};

export function Avatar({
  symbol,
  name,
  size = "md",
  className,
}: {
  symbol: string;
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const label = initials(name) || symbol.replace(/^\^/, "").slice(0, 2);
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden font-semibold tracking-tight text-white/95 shadow-inner",
        sizes[size],
        className,
      )}
      style={{ backgroundImage: symbolGradient(symbol) }}
    >
      <span className="relative z-10 drop-shadow-sm">{label}</span>
      <span className="absolute inset-0 bg-gradient-to-b from-white/15 to-black/20" />
    </div>
  );
}
