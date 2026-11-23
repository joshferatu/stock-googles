"use client";

import { ChartCandlestick, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PrivateAlphaBadge } from "@/components/private-alpha-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ next, sso }: { next: string; sso: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not sign in.");
        setLoading(false);
        return;
      }
      const body = (await response.json().catch(() => null)) as { stage?: "google" | "app" } | null;
      if (body?.stage === "google") {
        const target =
          next === "/" ? "/login/google" : `/login/google?next=${encodeURIComponent(next)}`;
        router.replace(target);
      } else {
        router.replace(next);
      }
      router.refresh();
    } catch {
      setError("Network unavailable. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="animate-fade-up w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="relative flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-accent-2 shadow-[0_14px_40px_-18px_var(--accent)]">
            <ChartCandlestick className="size-6 text-[#04120f]" strokeWidth={2.4} />
            <span className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Stock{" "}
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
              Googles
            </span>
          </h1>
          <PrivateAlphaBadge className="mt-2" />
          <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-muted">
            Private Alpha — early access; data and features may change.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-surface/70 p-5 shadow-xl backdrop-blur"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              {sso ? "Step 1 of 2 · shared password" : "Shared password"}
            </span>
          </div>

          <label
            htmlFor="password"
            className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted"
          >
            <Lock className="size-3" />
            Shared password
          </label>
          <Input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter the dashboard password"
            className="h-11"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
          />
          {error ? (
            <p id="login-error" className="mt-2 text-[11px] text-down" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-3 w-full">
            {sso ? "Continue" : "Enter dashboard"}
          </Button>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-muted/80">
            {sso
              ? "Next: sign in with your Google account. Only @gmail.com accounts are accepted during the alpha."
              : "No accounts, no database. The password protects the deployment; favourites live in your browser."}
          </p>
        </form>

        <Link
          href="/privacy"
          className="mt-4 block text-center text-[10px] text-muted transition hover:text-fg"
        >
          Privacy policy
        </Link>
      </div>
    </div>
  );
}
