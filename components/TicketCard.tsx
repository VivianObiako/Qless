import type { JSX, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TicketCardProps {
  children: ReactNode;
  /**
   * "paper" is the default ticket stock. "ink" is the state-03 inversion, where
   * the ticket goes dark against a paper shell. "signal" is state 04 only.
   */
  surface?: "paper" | "ink" | "signal";
  id?: string;
  className?: string;
}

const surfaceClasses = {
  paper: "bg-paper text-paper-ink",
  ink: "bg-paper-ink text-paper",
  signal: "bg-signal text-white",
} as const;

export function TicketCard({
  children,
  surface = "paper",
  id,
  className,
}: TicketCardProps): JSX.Element {
  return (
    <div
      id={id}
      className={cn(
        "rounded-[var(--radius-ticket)] overflow-hidden",
        surfaceClasses[surface],
        className,
      )}
    >
      {children}
    </div>
  );
}

interface PerforationProps {
  /**
   * The notches are punched out in the colour behind the ticket, so they have
   * to match whatever the ticket is sitting on.
   */
  notchColor?: "shell" | "paper";
  lineColor?: "paper-line" | "paper-dim" | "white";
  className?: string;
}

const notchClasses = {
  shell: "bg-shell",
  paper: "bg-paper",
} as const;

const lineClasses = {
  "paper-line": "border-paper-line",
  /** The tear line on an ink ticket, state 03. */
  "paper-dim": "border-paper/30",
  white: "border-white/35",
} as const;

/**
 * The tear line: a 12px notch bitten out of each edge with a dashed rule
 * between them. This is what makes the card read as a physical ticket rather
 * than another rounded rectangle.
 */
export function Perforation({
  notchColor = "shell",
  lineColor = "paper-line",
  className,
}: PerforationProps): JSX.Element {
  return (
    <div aria-hidden="true" className={cn("flex h-6 items-center", className)}>
      <span
        className={cn("h-6 w-3 rounded-r-full", notchClasses[notchColor])}
      />
      <span className={cn("h-px flex-1 border-t border-dashed", lineClasses[lineColor])} />
      <span
        className={cn("h-6 w-3 rounded-l-full", notchClasses[notchColor])}
      />
    </div>
  );
}

interface TicketBadgeProps {
  children: ReactNode;
  /** Inverted at "getting close" — ink fill, paper text. */
  inverted?: boolean;
  className?: string;
}

export function TicketBadge({
  children,
  inverted = false,
  className,
}: TicketBadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[var(--radius-badge)] border px-2 py-[5px]",
        "font-mono text-[9px] uppercase tracking-[0.18em]",
        inverted
          ? "border-paper-ink bg-paper-ink text-paper"
          : "border-current bg-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The five-segment progress bar that appears on the ticket once a customer is
 * three or fewer away.
 */
export function TicketProgress({ filled }: { filled: number }): JSX.Element {
  const segments = 5;

  return (
    <div
      aria-hidden="true"
      className="flex gap-1"
    >
      {Array.from({ length: segments }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-300",
            index < filled ? "bg-paper-ink" : "bg-paper-line",
          )}
        />
      ))}
    </div>
  );
}

