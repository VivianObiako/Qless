import type { JSX } from "react";
import { cn } from "@/lib/utils";
import type { Proximity } from "@/lib/types";

interface QueueProgressProps {
  peopleAhead: number;
  /** How many were ahead when this customer joined, if the browser recorded it. */
  joinedAhead: number | null;
  proximity: Proximity;
}

const fillClasses: Record<Proximity, string> = {
  waiting: "bg-ok",
  close: "bg-warn",
  next: "bg-warn",
  current: "bg-urgent",
};

/**
 * Shows movement rather than a percentage. When the browser recorded how many
 * were ahead at join time the bar measures real progress through the queue;
 * otherwise it degrades to a sensible relative fill for a recovered session.
 */
export function QueueProgress({
  peopleAhead,
  joinedAhead,
  proximity,
}: QueueProgressProps): JSX.Element {
  const fraction = progressFraction(peopleAhead, joinedAhead);
  const percent = Math.round(fraction * 100);

  return (
    <div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Progress through the queue"
        className="h-1.5 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", fillClasses[proximity])}
          style={{ width: `${Math.max(percent, 3)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-faint">
        <span>Joined</span>
        <span>Your turn</span>
      </div>
    </div>
  );
}

function progressFraction(peopleAhead: number, joinedAhead: number | null): number {
  if (peopleAhead <= 0) return 1;

  if (joinedAhead !== null && joinedAhead > 0) {
    const served = joinedAhead - peopleAhead;
    return clamp(served / joinedAhead, 0, 1);
  }

  // No join-time anchor: fall back to a curve that approaches, but never
  // reaches, full so the bar never overstates how close someone is.
  return clamp(1 - peopleAhead / (peopleAhead + 4), 0, 0.9);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
