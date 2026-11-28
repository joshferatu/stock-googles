"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, Settings, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { PrivateAlphaBadge } from "@/components/private-alpha-badge";
import { SearchCommand } from "@/components/search/search-command";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/lib/favorites-store";
import { useHydrated } from "@/lib/client-hooks";
import { UserStateSync } from "@/lib/user-state-sync";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/favorites", label: "Favourites", icon: Star },
  { href: "/search", label: "Search", icon: Search },
] as const;

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex min-w-0 items-center gap-2.5" aria-label="Stock Googles home">
      <BrandMark alt="" priority />
      {compact ? null : (
        <span className="text-[15px] font-semibold tracking-tight">
          Stock <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">Googles</span>
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const favoriteCount = useFavorites((state) => state.favorites.length);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="app-aura relative min-h-dvh">
      {/* User data is per account: sync it only inside the authenticated shell. */}
      <UserStateSync />
      <div className="relative z-10 lg:grid lg:min-h-dvh lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface/40 px-4 py-5 backdrop-blur-xl lg:flex">
          <Logo />
          <nav className="mt-8 flex flex-col gap-1" aria-label="Main navigation">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-accent/10 text-fg ring-1 ring-accent/20"
                      : "text-muted hover:bg-surface-2/70 hover:text-fg",
                  )}
                >
                  {active ? (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gradient-to-b from-accent to-accent-2" />
                  ) : null}
                  <Icon className={cn("size-4.5", active ? "text-accent" : "text-muted group-hover:text-fg")} />
                  {item.label}
                  {item.href === "/favorites" && hydrated && favoriteCount > 0 ? (
                    <span className="ml-auto rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                      {favoriteCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <CurrencySwitcher />
              <ThemeToggle />
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2/70 hover:text-fg"
            >
              <Settings className="size-4.5" />
              Settings
            </button>
            <PrivateAlphaBadge className="justify-start px-3" />
            <p className="px-3 text-[10px] leading-relaxed text-muted/70">
              Prices may be delayed. Not investment advice.
            </p>
          </div>
        </aside>

        <div className="flex min-h-dvh flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/70 backdrop-blur-xl">
            <div className="flex h-14 items-center gap-2 px-4 lg:h-16 lg:px-8">
              <div className="lg:hidden">
                <Logo compact />
              </div>

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="group ml-auto flex h-9 min-w-0 items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 text-xs text-muted transition hover:border-border-strong hover:text-fg lg:ml-0 lg:h-10 lg:w-full lg:max-w-md lg:px-3.5 lg:text-sm"
              >
                <Search className="size-4 shrink-0" />
                <span className="hidden truncate sm:inline">Search companies, indices, tickers…</span>
                <span className="sm:hidden">Search</span>
                <kbd className="ml-auto hidden rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted lg:inline">
                  ⌘K
                </kbd>
              </button>

              <div className="ml-auto flex items-center gap-1.5 lg:ml-3">
                <div className="hidden sm:block">
                  <CurrencySwitcher compact />
                </div>
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Settings"
                  className="lg:hidden"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings className="size-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="relative mx-auto w-full min-w-0 max-w-[1240px] flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-7">
            {children}
          </main>

          {/* Mobile bottom navigation */}
          <nav
            aria-label="Main navigation"
            className="fixed inset-x-0 bottom-0 z-30 w-full border-t border-border bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
          >
            <div className="mx-auto grid w-full max-w-md grid-cols-3">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex min-w-0 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition",
                      active ? "text-accent" : "text-muted",
                    )}
                  >
                    <span className="relative">
                      <Icon className="size-5" />
                      {item.href === "/favorites" && hydrated && favoriteCount > 0 ? (
                        <span className="absolute -right-2 -top-1 flex size-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-[#04120f]">
                          {favoriteCount > 9 ? "9+" : favoriteCount}
                        </span>
                      ) : null}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
