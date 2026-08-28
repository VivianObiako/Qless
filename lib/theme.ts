export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "qless.theme";

/** The direction's default. Light is a preference, not the baseline. */
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light";
}

/**
 * Runs before first paint, inlined into the document head, so the shell is
 * never painted in the wrong colour and then corrected. Kept as a string
 * because it has to execute ahead of hydration.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t!=="dark"&&t!=="light"){t=${JSON.stringify(
  DEFAULT_THEME,
)};}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme",${JSON.stringify(
  DEFAULT_THEME,
)});}})();`;

