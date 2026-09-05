import type { ButtonHTMLAttributes, JSX, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * paper         — primary: ink on the page. The name is from the ticket-stock
 *                 direction and is kept until the call sites move.
 * contrast      — primary that reads against whatever surface it lands on.
 *                 Used wherever the surface can invert: state 03 and the
 *                 operator dashboard. On the page it is the same as paper.
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
  paper: "bg-strong text-shell hover:opacity-90",
  contrast: "bg-strong text-shell hover:opacity-90",
  onSignal: "bg-white text-signal hover:bg-white/90",
  // The outline is what makes a ghost control a control, so it takes the
  // palette's boundary tone rather than the row hairline, which is not a
  // boundary anybody can see.
  ghost: "border border-faint bg-transparent text-strong hover:border-strong hover:bg-shell-mid",
  ghostOnSignal: "border border-white/70 text-white hover:border-white hover:bg-white/10",
};

const sizeClasses: Record<ButtonSize, string> = {
  // Taller under a finger: Apple's 44pt rule, met on the two sizes a
  // tablet counter actually presses.
  sm: "h-8 px-3 text-[13px] pointer-coarse:h-10",
  md: "h-[38px] px-4 text-[13.5px] pointer-coarse:h-11",
  lg: "h-[46px] px-5 text-[15px] pointer-coarse:h-12",
};

/**
 * The shared look of a control, so an anchor that acts as a button is styled
 * from the same source as the button rather than from a copy of its classes.
 *
 * A pill in sentence case at one weight. Hierarchy between controls is fill
 * against outline, never size or shouting.
 */
export function controlClasses(
  variant: ButtonVariant = "paper",
  size: ButtonSize = "lg",
  fullWidth = false,
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium",
    "transition-[color,background-color,border-color,opacity,transform] duration-150",
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
        "disabled:cursor-not-allowed disabled:border disabled:border-shell-line disabled:bg-transparent disabled:text-faint disabled:opacity-100",
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
      className="size-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent opacity-70"
    />
  );
}
