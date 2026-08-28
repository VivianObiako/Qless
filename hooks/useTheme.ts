"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readSession, subscribeToSession, writeSession } from "@/lib/session";
import { DEFAULT_THEME, isTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

interface ThemeControls {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

/**
 * The theme lives in localStorage and on the document element, both of which
 * are external stores — so it is read through useSyncExternalStore rather than
 * mirrored into React state.
 */
export function useTheme(): ThemeControls {
  const stored = useSyncExternalStore(
    subscribeToSession,
    useCallback((): string | null => readSession(THEME_STORAGE_KEY), []),
    useCallback((): string | null => null, []),
  );

  const theme: Theme = isTheme(stored) ? stored : DEFAULT_THEME;

  const setTheme = useCallback((next: Theme): void => {
    document.documentElement.setAttribute("data-theme", next);
    writeSession(THEME_STORAGE_KEY, next);
  }, []);

  const toggle = useCallback((): void => {
    // Nothing stored yet means the user is on the default, so the first click
    // has to flip away from that rather than re-assert it.
    const stored = readSession(THEME_STORAGE_KEY);
    const current: Theme = isTheme(stored) ? stored : DEFAULT_THEME;
    setTheme(current === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme, setTheme, toggle };
}
