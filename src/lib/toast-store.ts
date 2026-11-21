"use client";

import { create } from "zustand";

export type ToastTone = "default" | "success" | "error";

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (message, tone = "default") => {
    const id = ++counter;
    set({ items: [...get().items.slice(-2), { id, message, tone }] });
    setTimeout(() => get().dismiss(id), 2800);
  },
  dismiss: (id) => set({ items: get().items.filter((item) => item.id !== id) }),
}));

export function toast(message: string, tone: ToastTone = "default") {
  useToasts.getState().push(message, tone);
}
