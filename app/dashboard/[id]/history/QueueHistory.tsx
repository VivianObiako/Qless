"use client";

import { useEffect, useMemo, useState, type JSX } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
} from "lucide-react";
import { AccessNotice } from "@/components/AccessNotice";
import { Button, controlClasses } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
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
import { cn } from "@/lib/utils";
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

const PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 10;

type SortKey = "number" | "name" | "time";
type SortDirection = "asc" | "desc";

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
      <HistoryTable
        queueName={result.queue.name}
        entries={result.entries}
        showsNames={result.showsNames}
        viewerIsOwner={role !== "OPERATOR"}
        ownerName={result.ownerName}
      />
    );
  }

  return (
    <DashboardChrome
      queueId={queueId}
      tab="history"
      queueName={result?.queue.name}
      queueSlug={result?.queue.slug}
    >
      {body()}
    </DashboardChrome>
  );
}

/**
 * Who moved an entry, in the reader's words. Empty when the customer ended it
 * themselves. The owner is "You" to themselves, and their name — or "The
 * owner" — to staff.
 */
function servedBy(entry: HistoryEntry, viewerIsOwner: boolean, ownerName: string): string {
  if (entry.actedBy === null) return "";
  if (entry.actedBy.type === "OPERATOR") return entry.actedBy.operatorName ?? "Operator";
  if (viewerIsOwner) return "You";
  return ownerName || "The owner";
}

function nameFor(entry: HistoryEntry): string {
  return entry.customerName || `Customer ${entry.number}`;
}

function finishedAt(entry: HistoryEntry): string {
  return entry.completedAt ?? entry.joinedAt;
}

function minutesBetween(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
}

/** Whole minutes from joining to being called, or to the end if never called. */
function waitedMinutes(entry: HistoryEntry): number {
  return minutesBetween(entry.joinedAt, entry.startedAt ?? entry.completedAt ?? entry.joinedAt);
}

/** From the call to service beginning. Null when nobody marked the start. */
function arrivedMinutes(entry: HistoryEntry): number | null {
  if (!entry.startedAt || !entry.servedAt) return null;
  return minutesBetween(entry.startedAt, entry.servedAt);
}

/**
 * The service itself, from its beginning (or the call, for an entry nobody
 * marked) to done. Only a served entry that was called has one.
 */
function servedMinutes(entry: HistoryEntry): number | null {
  if (entry.status !== "ATTENDED" || !entry.completedAt) return null;
  const from = entry.servedAt ?? entry.startedAt;
  if (!from) return null;
  return minutesBetween(from, entry.completedAt);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === today) return "Today";
  if (key === dayKey(yesterday.toISOString())) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * The record of a queue's day: every finished entry as a row, sortable,
 * filterable by day, outcome and who served, with a summary of whatever is
 * in view and a way to take it away as a file.
 */
function HistoryTable({
  queueName,
  entries,
  showsNames,
  viewerIsOwner,
  ownerName,
}: {
  queueName: string;
  entries: HistoryEntry[];
  showsNames: boolean;
  viewerIsOwner: boolean;
  ownerName: string;
}): JSX.Element {
  const [day, setDay] = useState<string>("all");
  const [outcome, setOutcome] = useState<string>("all");
  const [by, setBy] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const days = useMemo(() => {
    const keys = new Set(entries.map((entry) => dayKey(finishedAt(entry))));
    return [...keys].sort().reverse();
  }, [entries]);

  const servers = useMemo(() => {
    const names = new Set(entries.map((entry) => servedBy(entry, viewerIsOwner, ownerName)).filter(Boolean));
    return [...names].sort();
  }, [entries, viewerIsOwner, ownerName]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = entries.filter(
      (entry) =>
        (day === "all" || dayKey(finishedAt(entry)) === day) &&
        // "Walk-in" is not an outcome, but it is the other thing an owner
        // wants to pull out of a day, and one menu is easier than two.
        (outcome === "all" || (outcome === "walkin" ? entry.walkIn : entry.status === outcome)) &&
        (by === "all" || servedBy(entry, viewerIsOwner, ownerName) === by) &&
        (needle === "" ||
          nameFor(entry).toLowerCase().includes(needle) ||
          String(entry.number) === needle),
    );
    const sign = direction === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      switch (sortKey) {
        case "number":
          return (a.number - b.number) * sign;
        case "name":
          return nameFor(a).localeCompare(nameFor(b)) * sign;
        default:
          return (new Date(finishedAt(a)).getTime() - new Date(finishedAt(b)).getTime()) * sign;
      }
    });
  }, [entries, day, outcome, by, search, sortKey, direction, viewerIsOwner, ownerName]);

  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const current = Math.min(page, pages);
  const rows = shown.slice((current - 1) * pageSize, current * pageSize);

  const served = shown.filter((entry) => entry.status === "ATTENDED");
  const summary = {
    served: served.length,
    skipped: shown.filter((entry) => entry.status === "SKIPPED").length,
    left: shown.filter((entry) => entry.status === "LEFT").length,
    averageWait: average(served.map(waitedMinutes)),
    averageService: average(served.map(servedMinutes).filter((value): value is number => value !== null)),
  };

  function sortBy(key: SortKey): void {
    if (key === sortKey) {
      setDirection(direction === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setDirection(key === "time" ? "desc" : "asc");
    }
    setPage(1);
  }

  function exportCsv(): void {
    const header = [
      "Number",
      "Name",
      "Outcome",
      "Served by",
      "Waited (min)",
      "Arrived (min)",
      "Served (min)",
      "Joined",
      "Called",
      "Service began",
      "Finished",
    ];
    const lines = shown.map((entry) =>
      [
        entry.number,
        showsNames ? entry.customerName : "",
        outcomeLabel[entry.status],
        servedBy(entry, viewerIsOwner, ownerName),
        waitedMinutes(entry),
        arrivedMinutes(entry) ?? "",
        servedMinutes(entry) ?? "",
        entry.joinedAt,
        entry.startedAt ?? "",
        entry.servedAt ?? "",
        entry.completedAt ?? "",
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${queueName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-history${day === "all" ? "" : `-${day}`}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-[clamp(30px,6vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
          History
        </h2>
        <button
          type="button"
          onClick={exportCsv}
          disabled={shown.length === 0}
          className={cn(controlClasses("ghost", "md"), "disabled:opacity-50")}
        >
          <Icon icon={Download} size={15} />
          Export CSV
        </button>
      </div>

      {!showsNames && (
        <p className="mt-3 max-w-md text-[14px] leading-[1.6] text-muted">
          This queue keeps customer names to its owner, so this history shows numbers only.
        </p>
      )}

      {entries.length === 0 ? (
        <p className="mt-6 max-w-md text-[14.5px] leading-[1.6] text-dim">
          Nothing finished yet. Customers appear here once they have been served, skipped, or have
          left the queue.
        </p>
      ) : (
        <>
          {/* Filters. Each one narrows the rows and the summary together. */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Select
              label="Day"
              value={day}
              onChange={(value) => {
                setDay(value);
                setPage(1);
              }}
              options={[{ value: "all", label: "All days" }, ...days.map((key) => ({ value: key, label: dayLabel(key) }))]}
            />
            <Select
              label="Outcome"
              value={outcome}
              onChange={(value) => {
                setOutcome(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All outcomes" },
                { value: "ATTENDED", label: "Served" },
                { value: "SKIPPED", label: "Skipped" },
                { value: "LEFT", label: "Left" },
                { value: "CLEARED", label: "Cleared" },
                { value: "walkin", label: "Walk-ins" },
              ]}
            />
            <Select
              label="Served by"
              value={by}
              onChange={(value) => {
                setBy(value);
                setPage(1);
              }}
              options={[{ value: "all", label: "Anyone" }, ...servers.map((name) => ({ value: name, label: name }))]}
            />
            <label className="relative ml-auto block w-full sm:w-[240px]">
              <span className="sr-only">Find by name or number</span>
              <Icon icon={Search} size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Name or number"
                className="h-9 w-full rounded-full border border-shell-line bg-shell-soft pl-9 pr-4 text-[13px] text-strong placeholder:text-muted focus:border-strong focus:outline-none pointer-coarse:h-10 pointer-coarse:text-[16px]"
              />
            </label>
          </div>

          {/* The summary of what is in view: the numbers an owner asks for. */}
          <dl className="mt-5 grid grid-cols-2 border-y border-shell-line sm:grid-cols-5">
            <Figure label="Served" value={String(summary.served)} />
            <Figure label="Skipped" value={String(summary.skipped)} />
            <Figure label="Left" value={String(summary.left)} />
            <Figure label="Average wait" value={summary.averageWait === null ? "—" : String(summary.averageWait)} unit={summary.averageWait === null ? undefined : "min"} />
            <Figure label="Average service" value={summary.averageService === null ? "—" : String(summary.averageService)} unit={summary.averageService === null ? undefined : "min"} />
          </dl>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-shell-line text-left">
                  <SortHeader label="No." active={sortKey === "number"} direction={direction} onClick={() => sortBy("number")} className="w-[80px]" />
                  <SortHeader label="Name" active={sortKey === "name"} direction={direction} onClick={() => sortBy("name")} />
                  <th className="py-2.5 pr-4 text-[12.5px] font-normal text-muted">Outcome</th>
                  <th className="py-2.5 pr-4 text-[12.5px] font-normal text-muted">Served by</th>
                  <th className="py-2.5 pr-4 text-right text-[12.5px] font-normal text-muted">Waited</th>
                  <th className="py-2.5 pr-4 text-right text-[12.5px] font-normal text-muted">Arrived</th>
                  <th className="py-2.5 pr-4 text-right text-[12.5px] font-normal text-muted">Served</th>
                  <SortHeader label="Time" active={sortKey === "time"} direction={direction} onClick={() => sortBy("time")} align="right" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[14px] text-muted">
                      Nothing matches these filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((entry) => (
                    <tr key={entry.id} className="border-b border-shell-line">
                      <td className="numeral py-3 pr-4 text-[20px] text-strong">{entry.number}</td>
                      <td className="max-w-[260px] truncate py-3 pr-4 font-medium text-strong">
                        {nameFor(entry)}
                        {entry.walkIn && <span className="ml-2 text-[12px] font-normal text-muted">Walk-in</span>}
                      </td>
                      <td className="py-3 pr-4 text-dim">{outcomeLabel[entry.status]}</td>
                      <td className="py-3 pr-4 text-dim">{servedBy(entry, viewerIsOwner, ownerName) || "—"}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-dim">{waitedMinutes(entry)} min</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-dim">
                        {arrivedMinutes(entry) === null ? "—" : `${arrivedMinutes(entry)} min`}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-dim">
                        {servedMinutes(entry) === null ? "—" : `${servedMinutes(entry)} min`}
                      </td>
                      <td className="py-3 text-right tabular-nums text-muted">
                        <time dateTime={finishedAt(entry)} suppressHydrationWarning>
                          {new Date(finishedAt(entry)).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </time>
                        {day === "all" && (
                          <span className="ml-2 text-[12px]" suppressHydrationWarning>
                            {dayLabel(dayKey(finishedAt(entry)))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination, over the rows in view: what is showing, how many
              per page, and first / previous / page / next / last. */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[13px] text-muted">
            <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="tabular-nums">
                {shown.length === 0
                  ? "0 of 0"
                  : `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, shown.length)} of ${shown.length}`}
              </span>
              <Select
                label="Per page"
                value={String(pageSize)}
                onChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
                options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
              />
            </span>
            <span className="flex items-center gap-1">
              <PageButton label="First page" disabled={current <= 1} onClick={() => setPage(1)} icon={ChevronsLeft} />
              <PageButton label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)} icon={ChevronLeft} />
              <span className="px-2 tabular-nums text-strong">
                Page {current} of {pages}
              </span>
              <PageButton label="Next page" disabled={current >= pages} onClick={() => setPage(current + 1)} icon={ChevronRight} />
              <PageButton label="Last page" disabled={current >= pages} onClick={() => setPage(pages)} icon={ChevronsRight} />
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function SortHeader({
  label,
  active,
  direction,
  onClick,
  align = "left",
  className,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
  className?: string;
}): JSX.Element {
  const glyph = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : undefined}
      className={cn("py-2.5 pr-4 font-normal", align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 text-[12.5px] transition-colors hover:text-strong pointer-coarse:py-2",
          active ? "text-strong" : "text-muted",
        )}
      >
        {label}
        <Icon icon={glyph} size={14} className={active ? "text-strong" : "text-faint"} />
      </button>
    </th>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}): JSX.Element {
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-muted">
      <span>{label}</span>
      {/* The browser's own chevron sits on the edge of a pill; ours sits
          inside it, with the padding to match. */}
      <span className="relative inline-flex">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 appearance-none rounded-full border border-shell-line bg-shell-soft pl-3.5 pr-10 text-[13px] text-strong focus:border-strong focus:outline-none pointer-coarse:h-10 pointer-coarse:text-[16px]"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          icon={ChevronDown}
          size={14}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
        />
      </span>
    </label>
  );
}

function PageButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof ChevronLeft;
  disabled: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(controlClasses("ghost", "sm"), "w-9 px-0 disabled:cursor-not-allowed disabled:opacity-40")}
    >
      <Icon icon={icon} size={14} />
    </button>
  );
}

function Figure({ label, value, unit }: { label: string; value: string; unit?: string }): JSX.Element {
  return (
    <div className="border-l border-shell-line px-5 py-3 first:border-l-0 first:pl-0 max-sm:[&:nth-child(odd)]:border-l-0 max-sm:[&:nth-child(odd)]:pl-0 max-sm:[&:nth-child(n+3)]:border-t">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="numeral mt-1 text-[24px] text-strong">
        {value}
        {unit && <span className="ml-1 font-sans text-[12.5px] tracking-normal text-muted">{unit}</span>}
      </dd>
    </div>
  );
}
