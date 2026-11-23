"use client";

import { ArrowLeft, ChartCandlestick } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PrivateAlphaBadge } from "@/components/private-alpha-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.6v3h3.86c2.26-2.09 3.58-5.17 3.58-8.84Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.14-4.07 1.14-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.64H1.29a12 12 0 0 0 0 10.72l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.64l3.98 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function GoogleLoginForm({
  next,
  mock,
  initialError,
  allowedDomain,
}: {
  next: string;
  mock: boolean;
  initialError: string | null;
  allowedDomain: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(`alpha@${allowedDomain}`);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  const startPath = next === "/" ? "/api/auth/google/start" : `/api/auth/google/start?next=${encodeURIComponent(next)}`;

  const submitMock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/google/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        next?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.ok) {
        setError(body?.error ?? "Could not sign in.");
        setLoading(false);
        return;
      }
      router.replace(body.next ?? next);
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
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Continue with Google</h1>
          <PrivateAlphaBadge className="mt-2" withCopy />
        </div>

        <div className="rounded-2xl border border-border bg-surface/70 p-5 shadow-xl backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Step 2 of 2 · Google account
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Sign in with the Google account you want shown in Settings. Only{" "}
            <span className="font-mono">@{allowedDomain}</span> accounts are accepted during the
            Private Alpha.
          </p>

          {error ? (
            <p className="mt-3 rounded-lg border border-down/25 bg-down/10 px-3 py-2 text-[11px] text-down" role="alert">
              {error}
            </p>
          ) : null}

          {mock ? (
            <form onSubmit={submitMock} className="mt-4">
              <label htmlFor="google-email" className="mb-1.5 block text-[11px] font-medium text-muted">
                Google email
              </label>
              <Input
                id="google-email"
                type="email"
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={`you@${allowedDomain}`}
                className="h-11"
              />
              <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-3 w-full">
                <GoogleMark className="size-4" />
                Continue with Google
              </Button>
              <p className="mt-2 text-center text-[10px] text-muted/80">
                Local mock mode — no Google account is contacted.
              </p>
            </form>
          ) : (
            <a
              href={startPath}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-2 px-5 text-sm font-medium text-[#04120f] shadow-[0_8px_24px_-12px_var(--accent)] transition hover:brightness-110 active:scale-[0.99]"
            >
              <GoogleMark className="size-4" />
              Continue with Google
            </a>
          )}

          <p className="mt-3 text-center text-[10px] leading-relaxed text-muted/80">
            The Google account identifies you; it is not used to fetch market data.
          </p>
          <Link
            href="/login"
            className="mt-4 flex items-center justify-center gap-1 text-[11px] text-muted transition hover:text-fg"
          >
            <ArrowLeft className="size-3" />
            Back to password
          </Link>
          <Link
            href="/privacy"
            className="mt-2 block text-center text-[10px] text-muted transition hover:text-fg"
          >
            Privacy policy
          </Link>
        </div>
      </div>
    </div>
  );
}
