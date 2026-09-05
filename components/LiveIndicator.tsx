import type { JSX } from "react";
import { MonoLabel } from "./Label";
import { cn } from "@/lib/utils";

export type ConnectionState = "live" | "reconnecting" | "called" | "offline";

interface LiveIndicatorProps {
  state: ConnectionState;
  className?: string;
}

const copy: Record<ConnectionState, string> = {
  live: "Live",
  reconnecting: "Reconnecting…",
  called: "Called",
  offline: "Offline",
};

/**
 * The connection state, and the product's only ambient motion. Reconnection is
 * shown by swapping the label in place — no layout shift, nothing intrusive.
 */
export function LiveIndicator({ state, className }: LiveIndicatorProps): JSX.Element {
  const dotClass =
    state === "live"
      ? "bg-strong animate-pulse-live"
      : state === "called"
        ? "bg-white animate-pulse-called"
        : state === "reconnecting"
          ? "bg-muted"
          : "bg-faint";

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", dotClass)} />
      <MonoLabel
        size={10}
       
        weight={state === "called" ? 600 : 400}
        tone="inherit"
        className={state === "live" || state === "called" ? "text-strong" : "text-muted"}
      >
        {copy[state]}
      </MonoLabel>
    </div>
  );
}

