"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type { DisplayCurrency } from "@/lib/fx";

export type Theme = "dark" | "light";

export const SETTINGS_STORAGE_KEY = "sg:settings:v1";
export const THEME_STORAGE_KEY = "sg:theme";

interface SettingsState {
  theme: Theme;
  displayCurrency: DisplayCurrency;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode: ignore.
  }
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      displayCurrency: "native",
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
      setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => (typeof window === "undefined" ? noopStorage : window.localStorage)),
      partialize: (state) => ({ theme: state.theme, displayCurrency: state.displayCurrency }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);
