"use client";

import type { JSX } from "react";
import { Moon, Sun } from "lucide-react";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  /**
   * "pill" carries its label and belongs in a nav bar. "quiet" is the 28px
   * mark used on the customer pass, where nothing may compete with the number.
   */
  variant?: "pill" | "quiet";
  className?: string;
}

/**
 * Light is the default and dark is the preference, so the control shows what
 * you would be switching to rather than where you are.
 */
export function ThemeToggle({ variant = "pill", className }: ThemeToggleProps): JSX.Element {
  const { theme, toggle } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";
  const glyph = nextTheme === "dark" ? Moon : Sun;
  const label = nextTheme === "dark" ? "Dark mode" : "Light mode";

  if (variant === "quiet") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={`Switch to ${nextTheme} mode`}
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full",
          "border border-shell-line text-muted transition-colors duration-200",
          "hover:border-strong hover:text-strong focus-visible:border-strong",
          className,
        )}
      >
        <Icon icon={glyph} size={14} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${nextTheme} mode`}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border border-shell-line px-3",
        "text-[13px] font-medium text-muted",
        "transition-colors duration-200 hover:border-strong hover:text-strong",
        className,
      )}
    >
      <Icon icon={glyph} size={14} />
      {label}
    </button>
  );
}
