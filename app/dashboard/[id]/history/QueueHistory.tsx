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
        <h2 className="text-[clamp(30px,6vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
          History
        </h2>

        {!result.showsNames && (
          <p className="mt-3 max-w-md text-[14px] leading-[1.6] text-muted">
            This queue keeps customer names to its owner, so this history shows numbers only.
          </p>
        )}

        {result.entries.length === 0 ? (
          <p className="mt-6 max-w-md text-[14.5px] leading-[1.6] text-dim">
            Nothing finished yet. Customers appear here once they have been served, skipped, or have
            left the queue.
          </p>
        ) : (
          <div className="mt-8 flex flex-col gap-8">
            {groupByDay(result.entries).map((group) => (
              <section key={group.key} aria-labelledby={`day-${group.key}`}>
                <h3 id={`day-${group.key}`} className="text-[12.5px] text-muted">
                  {group.label}
                  <span className="ml-2 text-faint">{group.entries.length}</span>
                </h3>
                <ul className="mt-2 flex flex-col border-t border-shell-line">
                  {group.entries.map((entry) => (
                    <HistoryRow key={entry.id} entry={entry} viewerIsOwner={role !== "OPERATOR"} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
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

interface DayGroup {
  key: string;
  label: string;
  entries: HistoryEntry[];
}

/**
 * The list arrives newest first, so the groups come out newest first too.
 * Days are named relative to the reader — today, yesterday — because that is
 * how an owner asks the question.
 */
function groupByDay(entries: HistoryEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const dayKey = (date: Date): string => date.toISOString().slice(0, 10);
  const todayKey = dayKey(today);
  const yesterdayKey = dayKey(yesterday);

  for (const entry of entries) {
    const finished = new Date(entry.completedAt ?? entry.joinedAt);
    const key = dayKey(finished);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      const label =
        key === todayKey
          ? "Today"
          : key === yesterdayKey
            ? "Yesterday"
            : finished.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
      group = { key, label, entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }

  return groups;
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
    <li className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 border-b border-shell-line py-3">
      <Numeral
        value={entry.number}
        scale="board"
        animateOnChange={false}
        className="text-strong"
      />

      <span className="min-w-0">
        <span className="block truncate text-[14.5px] font-medium text-strong">
          {entry.customerName || `Customer ${entry.number}`}
        </span>
        <span className="block truncate text-[12.5px] text-muted">
          {outcomeLabel[entry.status]}
          {by ? ` · by ${by}` : ""}
        </span>
      </span>

      {/* Rendered from the instant the server sent, in the reader's own zone —
          every timestamp leaves the API in UTC precisely so this can. */}
      <time
        dateTime={finished}
        className="shrink-0 text-[12.5px] tabular-nums text-muted"
        suppressHydrationWarning
      >
        {new Date(finished).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
      </time>
    </li>
  );
}
