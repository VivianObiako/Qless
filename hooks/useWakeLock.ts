"use client";

import { useEffect } from "react";

/**
 * Keeps the screen awake while the component is mounted.
 *
 * For the two screens that stay on all day — the counter and the wall
 * display — a tablet that dims to black is the most embarrassing failure the
 * product can have in a shop. The lock is released by the browser whenever
 * the page is hidden, so it is taken again when the page comes back.
 *
 * Best effort: a browser without the API, or one that refuses, simply does
 * nothing, and the screen behaves as it always did.
 */
export function useWakeLock(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async (): Promise<void> => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // Low battery, a browser setting, or a tab that lost focus mid-request.
        // None of these is worth telling the operator about.
        sentinel = null;
      }
    };

    const onVisibility = (): void => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release();
    };
  }, [enabled]);
}
