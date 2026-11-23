import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useInstallPrompt } from "@/lib/install";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function stubDisplayMode(standalone: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: standalone && query.includes("standalone"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

function promptEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt") as PromptEvent;
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe("useInstallPrompt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers nothing when the browser never fires beforeinstallprompt", async () => {
    stubDisplayMode(false);
    const { result } = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(result.current.promptInstall).toBeTypeOf("function"));
    expect(result.current.status).toBe("unsupported");
    await expect(result.current.promptInstall()).resolves.toBe("unavailable");
  });

  it("exposes the Chromium prompt and marks the app installed when accepted", async () => {
    stubDisplayMode(false);
    const { result } = renderHook(() => useInstallPrompt());
    const event = promptEvent("accepted");

    act(() => {
      window.dispatchEvent(event);
    });
    await waitFor(() => expect(result.current.status).toBe("prompt"));

    await act(async () => {
      await expect(result.current.promptInstall()).resolves.toBe("accepted");
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("installed");
  });

  it("stays available when the user dismisses the prompt", async () => {
    stubDisplayMode(false);
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(promptEvent("dismissed"));
    });
    await waitFor(() => expect(result.current.status).toBe("prompt"));

    await act(async () => {
      await expect(result.current.promptInstall()).resolves.toBe("dismissed");
    });
    expect(result.current.status).toBe("prompt");
  });

  it("falls back to instructions on iOS", async () => {
    stubDisplayMode(false);
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      configurable: true,
    });
    const { result } = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(result.current.status).toBe("ios"));
  });

  it("reports installed when already running standalone", async () => {
    stubDisplayMode(true);
    const { result } = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(result.current.status).toBe("installed"));
  });
});
