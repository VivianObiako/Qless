"use client";

import { useEffect, useState, type JSX } from "react";
import { AccessNotice } from "@/components/AccessNotice";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import { Numeral } from "@/components/Numeral";
import { QueueArranging } from "@/components/QueueArranging";
import { DashboardChrome } from "../DashboardChrome";
import { ApiError, getHistory } from "@/lib/api";
import { classifyUnauthorized, type AccessOutcome } from "@/lib/access";
import {
  clearSession,
  getSessionRole,
  ownerTokenKey,
  sessionRoleKey,
  sessionTokenKey,
  type SessionRole,
} from "@/lib/session";
import { useIsClient, useStoredValue } from "@/hooks/useStoredValue";
import type { EntryStatus, HistoryEntry, HistoryResponse } from "@/lib/types";

/** How a finished entry ended, in the operator's words rather than the enum's. */
const outcomeLabel: Record<EntryStatus, string> = {
  WAITING: "Waiting",
  SERVING: "At the counter",
  ATTENDED: "Served",
  SKIPPED: "Skipped",
  LEFT: "Left",
  CLEARED: "Cleared",
};

export function QueueHistory({ queueId }: { queueId: string }): JSX.Element {
  const isClient = useIsClient();
  const sessionToken = useStoredValue(sessionTokenKey());
  const legacyToken = useStoredValue(ownerTokenKey(queueId));
  const token = sessionToken ?? legacyToken;
  const role = useStoredValue(sessionRoleKey());

  const [result, setResult] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [access, setAccess] = useState<AccessOutcome | null>(null);
  const [endedAs, setEndedAs] = useState<SessionRole | null>(null);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    void (async () => {
      try {
        setResult(await getHistory(queueId, token, controller.signal));
        setError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (!(caught instanceof ApiError)) return;
        setError(caught);

        if (caught.status !== 401) return;

        const outcome = await classifyUnauthorized(token);
        if (outcome === null) return;
        if (outcome === "session-ended") {
          setEndedAs(getSessionRole());
          clearSession();
        }
        setAccess(outcome);
      }
    })();

    return () => controller.abort();
  }, [queueId, token]);

  // The queue is named once, by the chrome, so this screen's own title is an
  // h2 under it rather than a second h1.
  function body(): JSX.Element {
    if (!isClient || (token && !result && !error)) {
      return <QueueArranging className="mx-auto max-w-md" label="Loading history" />;
    }

    if (access !== null) {
      return <AccessNotice outcome={access} role={endedAs} what="queue" />;
    }

    if (!token || error?.status === 401) {
      return (
        <Notice
          tone="standing"
          title="Sign in to see this history"
          chip="!"
          action={<LinkButton href="/enter">Enter a code</LinkButton>}
        >
          History carries customer names, so it only opens for the people who run this queue.
        </Notice>
      );
    }

    if (error || !result) {
      return (
        <Notice tone="standing" title="Couldn't load history" chip="!">
          {error?.message ?? "Try again in a moment."}
        </Notice>
      );
    }

    return (
      <div>
        <h2 className="font-serif text-[clamp(34px,8vw,46px)] leading-[0.95] tracking-[-0.03em] text-strong">
          History.
        </h2>

        {!result.showsNames && (
          <p className="mt-4 max-w-md font-mono text-[11px] leading-[1.7] text-muted">
            This queue keeps customer names to its owner, so this history shows numbers only.
          </p>
        )}

        {result.entries.length === 0 ? (
          <p className="mt-6 max-w-md font-mono text-[13px] leading-[1.7] text-dim">
            Nothing finished yet. Customers appear here once they have been served, skipped, or have
            left the queue.
          </p>
        ) : (
          <ul className="mt-9 flex flex-col gap-px overflow-hidden rounded-[var(--radius-panel)] bg-shell-line">
            {result.entries.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} viewerIsOwner={role !== "OPERATOR"} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <DashboardChrome
      queueId={queueId}
      tab="history"
      queueName={result?.queue.name}
      width="narrow"
    >
      {body()}
    </DashboardChrome>
  );
}

function HistoryRow({
  entry,
  viewerIsOwner,
}: {
  entry: HistoryEntry;
  viewerIsOwner: boolean;
}): JSX.Element {
  const finished = entry.completedAt ?? entry.joinedAt;

  // Absent on entries the customer ended themselves, and on everything that
  // happened before operators existed. An owner's action reads as "you" only to
  // the owner — to staff it is somebody else entirely.
  const by =
    entry.actedBy === null
      ? null
      : entry.actedBy.type === "OPERATOR"
        ? entry.actedBy.operatorName
        : viewerIsOwner
          ? "you"
          : "the owner";

  return (
    <li className="flex items-center gap-4 bg-shell-soft px-5 py-4">
      <Numeral
        value={entry.number}
        scale="board"
        animateOnChange={false}
        className="w-12 shrink-0 text-strong"
      />

      <span className="min-w-0 flex-1">
        {/* Blank on a queue that keeps names to the owner. */}
        {entry.customerName && (
          <span className="block truncate font-serif text-[19px] leading-tight text-strong">
            {entry.customerName}
          </span>
        )}
        <span className="mt-1 block truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          {outcomeLabel[entry.status]}
          {by ? ` · by ${by}` : ""}
        </span>
      </span>

      {/* Rendered from the instant the server sent, in the reader's own zone —
          every timestamp leaves the API in UTC precisely so this can. */}
      <time
        dateTime={finished}
        className="shrink-0 font-mono text-[11px] text-muted"
        suppressHydrationWarning
      >
        {new Date(finished).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
      </time>
    </li>
  );
}

