import type { CSSProperties, ElementType, JSX, ReactNode } from "react";
import { cn } from "@/lib/utils";

type LabelTone = "muted" | "dim" | "strong" | "paper" | "faint" | "inherit";

interface MonoLabelProps {
  children: ReactNode;
  tone?: LabelTone;
  /** .16em is the tight end of the tracking range, .3em the loose end. */
  tracking?: "tight" | "wide" | "widest";
  size?: 9 | 10 | 11 | 12 | 13;
  weight?: 400 | 500 | 600;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** Escape hatch for label-as-<label>, which needs a control id. */
  htmlFor?: string;
  id?: string;
}

const toneClasses: Record<LabelTone, string> = {
  muted: "text-muted",
  dim: "text-dim",
  strong: "text-strong",
  paper: "text-paper-muted",
  faint: "text-faint",
  inherit: "",
};

const trackingClasses = {
  tight: "tracking-[0.16em]",
  wide: "tracking-[0.2em]",
  widest: "tracking-[0.3em]",
} as const;

const sizeClasses = {
  9: "text-[9px]",
  10: "text-[10px]",
  11: "text-[11px]",
  12: "text-[12px]",
  13: "text-[13px]",
} as const;

const weightClasses = {
  400: "font-normal",
  500: "font-medium",
  600: "font-semibold",
} as const;

/**
 * The product's only label style: IBM Plex Mono, uppercase, widely tracked.
 * Everything that is not a numeral or a headline is one of these.
 */
export function MonoLabel({
  children,
  tone = "muted",
  tracking = "wide",
  size = 10,
  weight = 400,
  as: Component = "span",
  className,
  style,
  htmlFor,
  id,
}: MonoLabelProps): JSX.Element {
  return (
    <Component
      style={style}
      htmlFor={htmlFor}
      id={id}
      className={cn(
        "font-mono uppercase",
        sizeClasses[size],
        trackingClasses[tracking],
        weightClasses[weight],
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </Component>
  );
}

