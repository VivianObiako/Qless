"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readSession, subscribeToSession, writeSession } from "@/lib/session";
import {
  DEFAULT_PREFERENCE,
  isThemePreference,
  resolveTheme,
  subscribeToSystemTheme,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeControls {
  /** What was asked for: light, dark, or follow the device. */
  preference: ThemePreference;
  /** What is on screen. */
  theme: Theme;
  setPreference: (preference: ThemePreference) => void;
  /** Flips between light and dark explicitly, whatever the preference was. */
  toggle: () => void;
}

const subscribeToBoth = (listener: () => void): (() => void) => {
  const unsubscribeSession = subscribeToSession(listener);
  const unsubscribeSystem = subscribeToSystemTheme(listener);
  return () => {
    unsubscribeSession();
    unsubscribeSystem();
  };
};

function readPreference(): ThemePreference {
  const stored = readSession(THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : DEFAULT_PREFERENCE;
}

/**
 * The theme lives in localStorage and on the document element, both of which
 * are external stores — so it is read through useSyncExternalStore rather
 * than mirrored into React state. The device's own scheme is a third store,
 * and it only matters while the preference is "system".
 */
export function useTheme(): ThemeControls {
  const preference = useSyncExternalStore(
    subscribeToBoth,
    readPreference,
    useCallback((): ThemePreference => DEFAULT_PREFERENCE, []),
  );

  const theme = useSyncExternalStore(
    subscribeToBoth,
    useCallback((): Theme => resolveTheme(readPreference()), []),
    useCallback((): Theme => "light", []),
  );

  // The document attribute is what the CSS reads. It is written before first
  // paint by the inline script and kept in step here for the rest of the
  // page's life — including when the device changes scheme under "system".
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference): void => {
    writeSession(THEME_STORAGE_KEY, next);
    document.documentElement.setAttribute("data-theme", resolveTheme(next));
  }, []);

  const toggle = useCallback((): void => {
    setPreference(resolveTheme(readPreference()) === "dark" ? "light" : "dark");
  }, [setPreference]);

  return { preference, theme, setPreference, toggle };
}
