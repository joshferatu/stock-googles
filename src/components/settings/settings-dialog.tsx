"use client";

import { Download, LogOut, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { PrivateAlphaBadge } from "@/components/private-alpha-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { useFavorites } from "@/lib/favorites-store";
import { exportFavoritesFile, importFavoritesFile } from "@/lib/favorites-io";
import type { DisplayCurrency } from "@/lib/fx";
import { useSessionInfo } from "@/lib/queries";
import { useSettings, type Theme } from "@/lib/settings-store";
import { toast } from "@/lib/toast-store";

const THEME_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

const CURRENCY_OPTIONS = [
  { value: "native", label: "Native" },
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
] as const;

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const theme = useSettings((state) => state.theme);
  const setTheme = useSettings((state) => state.setTheme);
  const displayCurrency = useSettings((state) => state.displayCurrency);
  const setDisplayCurrency = useSettings((state) => state.setDisplayCurrency);
  const favorites = useFavorites((state) => state.favorites);
  const clearFavorites = useFavorites((state) => state.clearFavorites);
  const { data: session } = useSessionInfo();
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing, setImporting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const count = await importFavoritesFile(file);
      toast(`${count} ${count === 1 ? "favourite" : "favourites"} imported`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Import failed", "error");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.assign("/login");
    } catch {
      setSigningOut(false);
      toast("Could not sign out", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="mt-0.5">
            Preferences and favourites are stored in this browser only.
          </DialogDescription>
        </div>

        <div className="max-h-[68dvh] divide-y divide-border/70 overflow-y-auto">
          <SettingRow label="Theme" description="Dark is easier on the eyes at night">
            <Segmented
              options={THEME_OPTIONS}
              value={theme}
              onChange={(value) => setTheme(value as Theme)}
              size="sm"
              ariaLabel="Theme"
            />
          </SettingRow>

          <SettingRow label="Display currency" description="Convert quotes using daily reference rates">
            <Segmented
              options={CURRENCY_OPTIONS}
              value={displayCurrency}
              onChange={(value) => setDisplayCurrency(value as DisplayCurrency)}
              size="sm"
              ariaLabel="Display currency"
            />
          </SettingRow>

          <SettingRow
            label="Favourites"
            description={`${favorites.length} saved in this browser · export to move devices`}
          >
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={favorites.length === 0}
                onClick={() => {
                  const count = exportFavoritesFile();
                  toast(`${count} exported`, "success");
                }}
              >
                <Download className="size-3.5" />
                Export
              </Button>
              <Button size="sm" variant="outline" loading={importing} onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-3.5" />
                Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void onImport(event.target.files?.[0])}
              />
              {confirmClear ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      clearFavorites();
                      setConfirmClear(false);
                      toast("Watchlist cleared");
                    }}
                  >
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={favorites.length === 0}
                  onClick={() => setConfirmClear(true)}
                  aria-label="Clear all favourites"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </SettingRow>

          {session?.required ? (
            <SettingRow
              label="Session"
              description={
                session.email
                  ? `Signed in with Google${session.mode === "mock" ? " (local mock)" : ""}`
                  : "Shared password session"
              }
            >
              <div className="flex flex-wrap items-center justify-end gap-2">
                {session.email ? (
                  <span
                    className="max-w-[200px] truncate rounded-md bg-surface-2 px-2 py-1 font-mono text-[10px] text-fg"
                    title={session.email}
                  >
                    {session.email}
                  </span>
                ) : null}
                <Button size="sm" variant="outline" loading={signingOut} onClick={() => void signOut()}>
                  <LogOut className="size-3.5" />
                  Sign out
                </Button>
              </div>
            </SettingRow>
          ) : null}

          <div className="px-5 py-4 text-[10px] leading-relaxed text-muted">
            <PrivateAlphaBadge className="mb-2 justify-start" withCopy />
            <p className="font-medium text-fg/80">Stock Googles · v1.0</p>
            <p className="mt-1">
              Quotes, charts and headlines come from Yahoo Finance and keyless fallback providers. Currency rates come
              from open.er-api.com (with a Frankfurter fallback). Data may be delayed by 15–20 minutes and is provided
              for information only, not investment advice.
            </p>
            <Link href="/privacy" className="mt-2 inline-block text-accent hover:underline">
              Privacy policy
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        {description ? <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}
