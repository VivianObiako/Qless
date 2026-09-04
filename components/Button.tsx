import type { ButtonHTMLAttributes, JSX, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * paper         — primary on the dark shell (ticket stock fill)
 * contrast      — primary that reads against whatever surface it lands on.
 *                 Used wherever the surface can invert: state 03 and the
 *                 operator dashboard.
 * onSignal      — white fill on the vermilion turn screen
 * ghost         — outline; re-tones with the surface
 * ghostOnSignal — outline on the vermilion turn screen
 */
export type ButtonVariant = "paper" | "contrast" | "onSignal" | "ghost" | "ghostOnSignal";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  // Paper stock is the page colour now, so the primary fill is ink on it —
  // the same thing "contrast" already was. Kept as a name until step 2.
  paper: "bg-strong text-shell hover:opacity-90",
  contrast: "bg-strong text-shell hover:opacity-90",
  onSignal: "bg-white text-signal hover:bg-white/90",
  // The outline is what makes a ghost control a control, so it takes the
  // palette's quietest legible tone rather than the row hairline — which sits
  // at 1.4:1 against the shell and is not a boundary anybody can see.
  ghost: "border border-faint text-muted hover:border-strong hover:text-strong",
  ghostOnSignal: "border border-white/80 text-white hover:border-white hover:bg-white/10",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-[10px]",
  md: "px-4 py-3 text-[11px]",
  lg: "px-5 py-[15px] text-[11px]",
};

/**
 * The shared look of a control, so an anchor that acts as a button is styled
 * from the same source as the button rather than from a copy of its classes.
 */
export function controlClasses(
  variant: ButtonVariant = "paper",
  size: ButtonSize = "lg",
  fullWidth = false,
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)]",
    "font-mono uppercase tracking-[0.18em]",
    "transition-[color,background-color,border-color,transform] duration-150",
    "active:scale-[0.99] motion-reduce:active:scale-100",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className,
  );
}

export function Button({
  variant = "paper",
  size = "lg",
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        controlClasses(variant, size, fullWidth),
        "disabled:cursor-not-allowed disabled:border disabled:border-shell-line disabled:bg-transparent disabled:text-faint",
        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

function Spinner(): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="size-3 shrink-0 animate-spin rounded-full border border-current border-t-transparent opacity-70"
    />
  );
}

