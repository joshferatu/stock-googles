"use client";

import { useCallback, useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * - `prompt`: Chromium captured `beforeinstallprompt`, we can open the dialog.
 * - `ios`: Safari never fires that event, so the user needs the share menu.
 * - `installed`: already running from the home screen / dock.
 * - `unsupported`: nothing to offer (e.g. Firefox, or criteria not met yet).
 */
export type InstallStatus = "prompt" | "ios" | "installed" | "unsupported";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Browser install flow: Chrome/Edge prompt where available, iOS instructions otherwise. */
export function useInstallPrompt() {
  const [status, setStatus] = useState<InstallStatus>("unsupported");
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) {
      setStatus("installed");
      return;
    }

    const onPrompt = (promptEvent: Event) => {
      promptEvent.preventDefault();
      setEvent(promptEvent as InstallPromptEvent);
      setStatus("prompt");
    };
    const onInstalled = () => {
      setEvent(null);
      setStatus("installed");
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (isIOS()) setStatus("ios");

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!event) return "unavailable" as const;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null);
    if (outcome === "accepted") setStatus("installed");
    return outcome;
  }, [event]);

  return { status, promptInstall };
}
