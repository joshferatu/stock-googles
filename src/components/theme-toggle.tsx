"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/client-hooks";
import { useSettings } from "@/lib/settings-store";

export function ThemeToggle({ className }: { className?: string }) {
  const hydrated = useHydrated();
  const theme = useSettings((state) => state.theme);
  const toggleTheme = useSettings((state) => state.toggleTheme);
  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
    >
      {!hydrated ? <Sun className="size-4 opacity-0" /> : isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
