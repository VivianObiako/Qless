import type { JSX } from "react";
import { MonoLabel } from "./Label";
import { cn } from "@/lib/utils";

interface QueueArrangingProps {
  rows?: number;
  className?: string;
  /** Screen-reader text for what is being loaded. */
  label?: string;
}

const statuses = ["At the counter", "Called next", "Waiting", "Waiting", "You"];

/**
 * The load state, drawn in the board's own vocabulary rather than a borrowed
 * spinner: numbered rows arrive from alternating sides and settle flush, a
 * queue arranging itself.
 *
 * The last row is the inverted "you" row, so the thing the customer is waiting
 * to see is the thing that lands last.
 */
export function QueueArranging({
  rows = 5,
  className,
  label = "Loading the queue",
}: QueueArrangingProps): JSX.Element {
  return (
    <div className={className} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>

      <div aria-hidden="true" className="overflow-hidden rounded-[var(--radius-panel)] bg-shell-line">
        {/* Dim rather than muted: this strip is the one place a label sits on
            shell-mid, and on the warm dashboard palette muted lands under 4.5:1
            against it. */}
        <div className="flex items-center justify-between bg-shell-mid px-4 py-2.5">
          <MonoLabel size={10} tone="dim">
            Board
          </MonoLabel>
          <MonoLabel size={10} tone="dim">
            Status
          </MonoLabel>
        </div>

        <div className="flex flex-col gap-px">
          {Array.from({ length: rows }, (_, index) => {
            const isYou = index === rows - 1;

            return (
              <div
                key={index}
                className={cn(
                  "flex items-center justify-between px-4 py-3.5",
                  // Alternating entry directions read as cards being tapped
                  // into a stack rather than a list fading in.
                  index % 2 === 0 ? "animate-arrange-left" : "animate-arrange-right",
                  isYou ? "bg-board-hi-bg" : "bg-board-row",
                )}
                style={{ animationDelay: `${index * 110}ms` }}
              >
                <span
                  className={cn(
                    "numeral text-[24px]",
                    isYou ? "text-board-hi-fg" : "text-faint",
                  )}
                >
                  {19 + index}
                </span>
                <MonoLabel
                  size={10}
                  tone="inherit"
                  weight={isYou ? 600 : 400}
                  className={isYou ? "text-board-hi-fg" : "text-muted"}
                >
                  {statuses[index % statuses.length]}
                </MonoLabel>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

