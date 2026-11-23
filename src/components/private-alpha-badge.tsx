import { cn } from "@/lib/utils";

/** Consistent Private Alpha labelling across the login flow and the app. */
export function PrivateAlphaBadge({
  className,
  withCopy = false,
}: {
  className?: string;
  withCopy?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-2 gap-y-1", className)}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-accent">
        <span className="size-1.5 rounded-full bg-accent" />
        Private Alpha
      </span>
      {withCopy ? (
        <span className="text-[10px] text-muted">— early access; data and features may change</span>
      ) : null}
    </div>
  );
}
