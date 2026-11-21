import Link from "next/link";

export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Stock Googles</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">You are offline</h1>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          The last quotes you loaded may still be available. Reconnect to refresh prices, charts and news.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 px-4 text-sm font-medium text-[#04120f]"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
