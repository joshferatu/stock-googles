"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SearchSurface } from "@/components/search/search-surface";

export function SearchCommand({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Search markets</DialogTitle>
        <DialogDescription className="sr-only">
          Search for listed companies, ETFs and indices worldwide.
        </DialogDescription>
        <SearchSurface autoFocus onNavigate={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
