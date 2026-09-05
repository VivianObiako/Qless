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
  /** Board rows and list rows. */
  board: "text-[22px]",
  /** Secondary figures on the ticket — now serving, ahead. */
  small: "text-[30px]",
  /** Estimated wait range. */
  medium: "text-[clamp(28px,8vw,36px)]",
  /** The customer's own number, states 01 and 02. */
  hero: "text-[clamp(88px,30vw,116px)]",
  /** State 03 — you're next. */
  next: "text-[clamp(110px,40vw,150px)]",
  /** State 04 — it's your turn. */
  turn: "text-[clamp(140px,54vw,230px)]",
  /** Room display. */
  display: "text-[clamp(140px,26vw,250px)]",
} as const;

/**
 * A queue number. Geist at 500, tabular figures, tight tracking — the single
 * most important element in the product. A bold sans reads larger than a
 * light serif at the same size, so every scale sits a step under the old one.
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

