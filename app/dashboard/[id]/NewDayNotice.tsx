"use client";

import { useState, type JSX } from "react";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { useNow } from "@/hooks/useNow";
import type { OperatorView } from "@/lib/types";

/** How long a queue has to sit idle before the next opening reads as a new day. */
const NEW_DAY_AFTER_MS = 12 * 60 * 60 * 1000;

function dismissKey(queueId: string): string {
  return `qless.newday.${queueId}`;
}

function readDismissed(queueId: string): string | null {
  try {
    return sessionStorage.getItem(dismissKey(queueId));
  } catch {
    return null;
  }
}

function writeDismissed(queueId: string, lastActivityAt: string): void {
  try {
    sessionStorage.setItem(dismissKey(queueId), lastActivityAt);
  } catch {
    // Nothing to do: the prompt shows again on the next load, which is fine.
  }
}

/**
 * The question a dashboard asks once when it is opened the morning after:
 * start numbering again, or keep counting? No automatic reset — that is a
 * decision about the business — but the first customer of a new day should
 * not be number 48 because nobody thought to ask.
 */
export function NewDayNotice({
  queueId,
  view,
  onStart,
}: {
  queueId: string;
  view: OperatorView;
  onStart: () => void;
}): JSX.Element | null {
  const [dismissed, setDismissed] = useState<string | null>(() => readDismissed(queueId));
  const now = useNow(60_000);

  const idle =
    view.serving === null && view.waiting.length === 0 && view.queue.nextNumber > 1 && view.lastActivityAt !== null;
  if (!idle || view.lastActivityAt === null) return null;
  if (now - Date.parse(view.lastActivityAt) < NEW_DAY_AFTER_MS) return null;
  if (dismissed === view.lastActivityAt) return null;

  const last = new Date(view.lastActivityAt).toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });

  function keep(): void {
    if (view.lastActivityAt === null) return;
    writeDismissed(queueId, view.lastActivityAt);
    setDismissed(view.lastActivityAt);
  }

  return (
    <Notice
      tone="quiet"
      title="Start a new day?"
      className="mb-6"
      action={
        <div className="flex flex-wrap gap-2">
          <Button variant="contrast" size="sm" onClick={onStart}>
            Start again at 1
          </Button>
          <Button variant="ghost" size="sm" onClick={keep}>
            Keep counting
          </Button>
        </div>
      }
    >
      Nothing has happened here since {last}, and the next number would be {view.queue.nextNumber}.
      Clearing the queue starts again at 1 and keeps the history.
    </Notice>
  );
}
