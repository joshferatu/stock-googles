"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { SearchSurface } from "@/components/search/search-surface";
import { PageHeading } from "@/components/section-header";
import { Card } from "@/components/ui/card";

export function SearchView() {
  const [key, setKey] = useState(0);

  return (
    <div className="animate-fade-up mx-auto w-full max-w-2xl space-y-5">
      <PageHeading
        eyebrow="Global search"
        title="Find any listed company"
        description="Stocks, ETFs and indices from every major exchange, by name or ticker."
      />
      <Card className="overflow-hidden">
        <SearchSurface key={key} autoFocus onNavigate={() => setKey((value) => value + 1)} />
      </Card>
      <div className="flex items-center gap-2 px-1 text-[11px] text-muted">
        <Search className="size-3" />
        <span>
          Examples: <span className="font-mono">AAPL</span>, <span className="font-mono">TEF.MC</span>,{" "}
          <span className="font-mono">^IXIC</span>, Telefónica, Nasdaq, Toyota
        </span>
      </div>
    </div>
  );
}
