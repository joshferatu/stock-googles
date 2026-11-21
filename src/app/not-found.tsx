import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-4xl font-semibold text-muted/40">404</p>
      <h1 className="mt-3 text-lg font-semibold">Page not found</h1>
      <Link href="/" className="mt-4 text-xs font-medium text-accent hover:underline">
        Go to Stock Googles
      </Link>
    </div>
  );
}
