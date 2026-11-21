"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card className="p-6 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
          {error.message || "An unexpected error occurred while loading this view."}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw className="size-3.5" />
            Try again
          </Button>
          <Link href="/">
            <Button size="sm" variant="primary">Back to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
