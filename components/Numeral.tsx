"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { cn } from "@/lib/utils";

interface NumeralProps {
  value: number | string | null;
  /**
   * Fluid sizing. Queue numerals never render below 24px, so every scale here
   * clamps above that.
   */
  scale?: "board" | "small" | "medium" | "hero" | "next" | "turn" | "display";
  className?: string;
  /** Re-animate when the value changes. Off for static numerals in lists. */
  animateOnChange?: boolean;
}

const scaleClasses = {
  /** Board rows. */
  board: "text-[24px]",
  /** Secondary figures on the ticket — now serving, ahead. */
  small: "text-[34px]",
  /** Estimated wait range. */
  medium: "text-[clamp(30px,9vw,40px)]",
  /** The customer's own number, states 01 and 02. */
  hero: "text-[clamp(96px,32vw,126px)]",
  /** State 03 — you're next. */
  next: "text-[clamp(120px,42vw,168px)]",
  /** State 04 — it's your turn. */
  turn: "text-[clamp(150px,58vw,250px)]",
  /** Room display. */
  display: "text-[clamp(140px,26vw,264px)]",
} as const;

/**
 * A queue number. Instrument Serif, tabular figures, tight tracking — the
 * single most important element in the product.
 */
export function Numeral({
  value,
  scale = "hero",
  className,
  animateOnChange = true,
}: NumeralProps): JSX.Element {
  const [animate, setAnimate] = useState(false);
  const previous = useRef<number | string | null>(value);

  useEffect(() => {
    if (!animateOnChange || previous.current === value) return;
    previous.current = value;
    setAnimate(true);
    const timer = window.setTimeout(() => setAnimate(false), 280);
    return () => window.clearTimeout(timer);
  }, [value, animateOnChange]);

  return (
    <span
      className={cn("numeral block", scaleClasses[scale], animate && "animate-numeral-in", className)}
    >
      {value ?? "—"}
    </span>
  );
}

