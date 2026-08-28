"use client";

import type { JSX } from "react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  /**
   * "pill" carries its label and belongs in a nav bar. "quiet" is the 20px
   * mark used on the customer pass, where nothing may compete with the number.
   */
  variant?: "pill" | "quiet";
  className?: string;
}

/**
 * Dark is the default and light is the preference, so the control states what
 * you would be switching to rather than where you are.
 *
 * The mark is drawn from the ticket: a stub whose fill inverts. No sun, no
 * moon — the product has no icon language and does not need one for this.
 */
export function ThemeToggle({ variant = "pill", className }: ThemeToggleProps): JSX.Element {
  const { theme, toggle } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  if (variant === "quiet") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={`Switch to ${nextTheme} mode`}
        className={cn(
          "group grid size-5 shrink-0 place-items-center rounded-[3px]",
          "border border-shell-line transition-colors duration-200",
          "hover:border-strong focus-visible:border-strong",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "block h-2.5 w-2.5 rounded-[1px] transition-all duration-300",
            theme === "dark" ? "bg-faint group-hover:bg-strong" : "bg-strong",
          )}
          style={{ clipPath: theme === "dark" ? "inset(0 50% 0 0)" : "inset(0)" }}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${nextTheme} mode`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-shell-line px-3 py-1.5",
        "font-mono text-[10px] uppercase tracking-[0.2em] text-muted",
        "transition-colors duration-200 hover:border-strong hover:text-strong",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="block size-2 rounded-[1px] bg-current transition-all duration-300"
        style={{ clipPath: theme === "dark" ? "inset(0 50% 0 0)" : "inset(0)" }}
      />
      {nextTheme} mode
    </button>
  );
}

