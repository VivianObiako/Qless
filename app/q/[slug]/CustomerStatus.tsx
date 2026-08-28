"use client";

import type { JSX } from "react";
import { QueueNumber } from "@/components/QueueNumber";
import { QueueProgress } from "@/components/QueueProgress";
import { cn } from "@/lib/utils";
import { proximityOf, type CustomerView, type Proximity, type QueueEntry } from "@/lib/types";

interface CustomerStatusProps {
  view: CustomerView;
  entry: QueueEntry;
  joinedAhead: number | null;
}

interface ProximityCopy {
  headline: string;
  detail: string;
  tone: "ok" | "warn" | "urgent";
}

const copy: Record<Proximity, ProximityCopy> = {
  waiting: {
    headline: "You're in the queue",
    detail: "Feel free to walk away. Keep this page open and it'll keep up.",
    tone: "ok",
  },
  close: {
    headline: "You're getting close",
    detail: "Start heading back.",
    tone: "warn",
  },
  next: {
    headline: "You're next",
    detail: "Please make your way over.",
    tone: "warn",
  },
  current: {
    headline: "It's your turn",
    detail: "Head to the counter now.",
    tone: "urgent",
  },
};

const headlineClasses: Record<ProximityCopy["tone"], string> = {
  ok: "text-ok",
  warn: "text-warn",
  urgent: "text-urgent",
};

const panelClasses: Record<ProximityCopy["tone"], string> = {
  ok: "border-line bg-surface",
  warn: "border-warn/30 bg-warn-soft",
  urgent: "border-urgent/40 bg-urgent-soft",
};

const numberTone: Record<Proximity, "ok" | "warn" | "urgent"> = {
  waiting: "ok",
  close: "warn",
  next: "warn",
  current: "urgent",
};

export function CustomerStatus({ view, entry, joinedAhead }: CustomerStatusProps): JSX.Element {
  const proximity = proximityOf(entry, view.peopleAhead);
  const { headline, detail, tone } = copy[proximity];

  return (
    <div className="space-y-8">
      {/*
        One live region for the whole state. Polite so it never interrupts, and
        it announces the headline plus the numbers that changed rather than
        firing a separate announcement per element.
      */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "rounded-[var(--radius-card)] border px-5 py-6 transition-colors duration-300",
          panelClasses[tone],
        )}
      >
        <p className={cn("text-lg font-semibold tracking-tight", headlineClasses[tone])}>
          {headline}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{detail}</p>

        <QueueNumber
          value={entry.number}
          tone={numberTone[proximity]}
          size="lg"
          label="Your number"
          className="mt-6"
        />

        {entry.status === "WAITING" && (
          <p className="mt-4 text-sm text-ink">
            <span className="numeral text-base font-semibold">{view.peopleAhead}</span>{" "}
            {view.peopleAhead === 1 ? "person" : "people"} ahead of you
          </p>
        )}
      </div>

      {entry.status === "WAITING" && (
        <QueueProgress
          peopleAhead={view.peopleAhead}
          joinedAhead={joinedAhead}
          proximity={proximity}
        />
      )}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line">
        <div className="bg-surface px-4 py-4">
          <dt className="text-[13px] text-ink-muted">Now serving</dt>
          <dd className="numeral mt-1 text-[28px] text-ink">
            {view.state.servingNumber === null ? (
              <span className="text-ink-faint">—</span>
            ) : (
              `#${view.state.servingNumber}`
            )}
          </dd>
        </div>
        <div className="bg-surface px-4 py-4">
          <dt className="text-[13px] text-ink-muted">Estimated wait</dt>
          <dd className="mt-1 text-[15px] font-medium text-ink">
            {view.estimate ? (
              view.estimate.label
            ) : entry.status === "SERVING" ? (
              "Now"
            ) : (
              "Almost there"
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

