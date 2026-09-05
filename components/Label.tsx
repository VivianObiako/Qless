import type { CSSProperties, ElementType, JSX, ReactNode } from "react";
import { cn } from "@/lib/utils";

type LabelTone = "muted" | "dim" | "strong" | "paper" | "faint" | "inherit";

interface MonoLabelProps {
  children: ReactNode;
  tone?: LabelTone;
  size?: 9 | 10 | 11 | 12 | 13;
  weight?: 400 | 500 | 600;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** Escape hatch for label-as-<label>, which needs a control id. */
  htmlFor?: string;
  id?: string;
  "aria-hidden"?: boolean;
}

const toneClasses: Record<LabelTone, string> = {
  muted: "text-muted",
  dim: "text-dim",
  strong: "text-strong",
  paper: "text-paper-muted",
  faint: "text-faint",
  inherit: "",
};

/**
 * The sizes are the steps the old uppercase scale had, mapped up a point or
 * two: sentence case at 10px is smaller than caps at 10px, and nothing that
 * is read should sit below 12px.
 */
const sizeClasses = {
  9: "text-[11px]",
  10: "text-[12px]",
  11: "text-[12.5px]",
  12: "text-[13px]",
  13: "text-[14px]",
} as const;

/** 600 is accepted for the call sites that ask for it and drawn as 500: nothing in the product goes heavier. */
const weightClasses = {
  400: "font-normal",
  500: "font-medium",
  600: "font-medium",
} as const;

/**
 * The product's label voice: sentence case, quiet, one weight. Everything that
 * is not a numeral, a heading or body copy is one of these.
 *
 * Named for the mono direction it replaced; the call sites move in later
 * steps and the name goes with them.
 */
export function MonoLabel({
  children,
  tone = "muted",
  size = 10,
  weight = 400,
  as: Component = "span",
  className,
  style,
  htmlFor,
  id,
  "aria-hidden": ariaHidden,
}: MonoLabelProps): JSX.Element {
  return (
    <Component
      style={style}
      htmlFor={htmlFor}
      id={id}
      aria-hidden={ariaHidden}
      className={cn(sizeClasses[size], weightClasses[weight], toneClasses[tone], className)}
    >
      {children}
    </Component>
  );
}
