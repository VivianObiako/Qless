export type Theme = "dark" | "light";

/** What the person asked for. "system" follows the device and is resolved at paint time. */
export type ThemePreference = Theme | "system";

export const THEME_STORAGE_KEY = "qless.theme";

/** The direction's default. Dark is a preference, not the baseline. */
export const DEFAULT_PREFERENCE: ThemePreference = "light";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light";
}

export function isThemePreference(value: string | null): value is ThemePreference {
  return isTheme(value) || value === "system";
}

/** The theme a preference lands on, on this device, right now. */
export function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  if (typeof window === "undefined") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function subscribeToSystemTheme(listener: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/**
 * Runs before first paint, inlined into the document head, so the shell is
 * never painted in the wrong colour and then corrected. Kept as a string
 * because it has to execute ahead of hydration. It mirrors resolveTheme:
 * a stored "system" asks the device, anything else unrecognised is the default.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t!=="dark"&&t!=="light"&&t!=="system"){t=${JSON.stringify(DEFAULT_PREFERENCE)};}if(t==="system"){t=window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;
