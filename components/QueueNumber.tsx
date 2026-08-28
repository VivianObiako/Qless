"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { cn } from "@/lib/utils";

type NumberTone = "ink" | "accent" | "ok" | "warn" | "urgent" | "muted";
type NumberSize = "sm" | "md" | "lg" | "xl";

interface QueueNumberProps {
  value: number | null;
  tone?: NumberTone;
  size?: NumberSize;
  /** Rendered above the number, small and quiet. The number is the message. */
  label?: string;
  className?: string;
}

const toneClasses: Record<NumberTone, string> = {
  ink: "text-ink",
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  urgent: "text-urgent",
  muted: "text-faint",
};

const sizeClasses: Record<NumberSize, string> = {
  sm: "text-[32px]",
  md: "text-[48px]",
  lg: "text-[72px] sm:text-[88px]",
  xl: "text-[112px] sm:text-[140px]",
};

/**
 * The queue number, the product's primary visual element. It re-animates
 * only when the value actually changes, so a background refetch that returns
 * the same number stays completely still.
 */
export function QueueNumber({
  value,
  tone = "ink",
  size = "lg",
  label,
  className,
}: QueueNumberProps): JSX.Element {
  const [animate, setAnimate] = useState(false);
  const previous = useRef<number | null>(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setAnimate(true);
    const timer = window.setTimeout(() => setAnimate(false), 240);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div className={className}>
      {label && (
        <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted">{label}</p>
      )}
      <p
        key={value}
        className={cn(
          "numeral mt-1.5",
          sizeClasses[size],
          toneClasses[tone],
          animate && "animate-number-in",
        )}
      >
        {value === null ? <span className="text-faint">—</span> : `#${value}`}
      </p>
    </div>
  );
}
