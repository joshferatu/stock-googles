import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="font-mono text-4xl font-semibold text-muted/40">404</p>
      <h1 className="mt-3 text-lg font-semibold">That page does not exist</h1>
      <p className="mt-1 text-xs text-muted">The ticker or route may have moved.</p>
      <Link
        href="/"
        className="mt-5 inline-flex h-9 items-center rounded-xl border border-border-strong px-4 text-xs font-medium transition hover:bg-surface-2"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
