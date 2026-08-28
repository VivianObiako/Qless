"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readSession, subscribeToSession } from "@/lib/session";

/**
 * Reads a session key as an external store rather than copying it into state
 * on mount. Keeps the value correct across tabs and avoids the cascading
 * render that a read-in-effect would cause.
 */
export function useStoredValue(key: string): string | null {
  const getSnapshot = useCallback((): string | null => readSession(key), [key]);

  // The server has no localStorage, so it always renders the empty case; the
  // client snapshot takes over on hydration.
  const getServerSnapshot = useCallback((): string | null => null, []);

  return useSyncExternalStore(subscribeToSession, getSnapshot, getServerSnapshot);
}

const subscribeToNothing = (): (() => void) => (): void => {};

/**
 * True once running on the client. Lets a component distinguish "this browser
 * has no stored token" from "we have not read storage yet", without which the
 * dashboard would flash its no-access state during hydration.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

/**
 * The page's own origin, or "" while rendering on the server. Used to build
 * shareable links that match whatever host the operator actually opened.
 */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => "",
  );
}

export function useStoredNumber(key: string): number | null {
  const raw = useStoredValue(key);
  if (raw === null) return null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

