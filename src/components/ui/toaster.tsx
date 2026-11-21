"use client";

import { Check, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToasts } from "@/lib/toast-store";

export function Toaster() {
  const items = useToasts((state) => state.items);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "animate-slide-up flex items-center gap-2.5 rounded-full border border-border bg-surface/95 px-4 py-2 text-sm shadow-lg backdrop-blur",
            item.tone === "error" && "border-down/40 text-down",
            item.tone === "success" && "border-up/40",
          )}
        >
          {item.tone === "success" ? (
            <Check className="size-4 text-up" />
          ) : item.tone === "error" ? (
            <TriangleAlert className="size-4" />
          ) : (
            <Info className="size-4 text-accent" />
          )}
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}
