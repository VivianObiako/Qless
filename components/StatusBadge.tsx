import type { JSX } from "react";
import { cn } from "@/lib/utils";
import type { EntryStatus, QueueStatus } from "@/lib/types";

type Tone = "ok" | "warn" | "urgent" | "idle" | "brand";

interface StatusBadgeProps {
  tone: Tone;
  children: string;
  className?: string;
}

const toneClasses: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  urgent: "bg-urgent-soft text-urgent",
  idle: "bg-idle-soft text-idle",
  brand: "bg-brand-soft text-brand",
};

const dotClasses: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  urgent: "bg-urgent",
  idle: "bg-idle",
  brand: "bg-brand",
};

/**
 * A dot alone would make colour the only signal, so the label always ships
 * with it. The dot is decorative and hidden from assistive technology.
 */
export function StatusBadge({ tone, children, className }: StatusBadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", dotClasses[tone])} />
      {children}
    </span>
  );
}

const queueStatusTone: Record<QueueStatus, Tone> = {
  OPEN: "ok",
  PAUSED: "warn",
  CLOSED: "urgent",
};

const queueStatusLabel: Record<QueueStatus, string> = {
  OPEN: "Open",
  PAUSED: "Paused",
  CLOSED: "Closed",
};

export function QueueStatusBadge({
  status,
  className,
}: {
  status: QueueStatus;
  className?: string;
}): JSX.Element {
  return (
    <StatusBadge tone={queueStatusTone[status]} className={className}>
      {queueStatusLabel[status]}
    </StatusBadge>
  );
}

const entryStatusTone: Record<EntryStatus, Tone> = {
  WAITING: "idle",
  SERVING: "ok",
  ATTENDED: "idle",
  SKIPPED: "warn",
  LEFT: "idle",
  CLEARED: "idle",
};

const entryStatusLabel: Record<EntryStatus, string> = {
  WAITING: "Waiting",
  SERVING: "Now serving",
  ATTENDED: "Attended",
  SKIPPED: "Skipped",
  LEFT: "Left",
  CLEARED: "Cleared",
};

export function EntryStatusBadge({
  status,
  className,
}: {
  status: EntryStatus;
  className?: string;
}): JSX.Element {
  return (
    <StatusBadge tone={entryStatusTone[status]} className={className}>
      {entryStatusLabel[status]}
    </StatusBadge>
  );
}

