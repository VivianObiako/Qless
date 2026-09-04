"use client";

import { useEffect, useId, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { ChevronDown, MoreHorizontal, Search } from "lucide-react";
import { Button, controlClasses } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Numeral } from "@/components/Numeral";
import { useDisclosure } from "@/hooks/useDisclosure";
import { minutesSince, useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import { StatusDot } from "./QueueSwitcher";
import type { EntryAction, OperatorView, Queue, QueueAction, WaitingRow } from "@/lib/types";

/**
 * What the operator is being asked to confirm, if anything. A dialog on skip,
 * close and reset — and deliberately not on serve next, which is the action
 * they take all day.
 */
export type Confirmation =
  | { kind: "skip"; entry: WaitingRow }
  | { kind: "close" }
  | { kind: "reset" }
  | null;

interface CounterProps {
  view: OperatorView;
  isOwner: boolean;
  serving: boolean;
  pendingEntryId: string | null;
  pendingAction: QueueAction | null;
  onServeNext: () => Promise<void>;
  onEntry: (entryId: string, action: EntryAction) => void;
  onQueue: (action: QueueAction) => void;
  onConfirm: (confirmation: Confirmation) => void;
}

/** A row's name, or the number said as a name when the queue keeps names to its owner. */
function nameFor(entry: { customerName: string; number: number }): string {
  return entry.customerName || `Customer ${entry.number}`;
}

/**
 * The working screen. The person at the counter, one button for the next
 * one, and the waiting list as a ledger with one visible action per row.
 */
export function Counter({
  view,
  isOwner,
  serving,
  pendingEntryId,
  pendingAction,
  onServeNext,
  onEntry,
  onQueue,
  onConfirm,
}: CounterProps): JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <CounterHeading />
      <Stats view={view} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
        <AtTheCounter
          view={view}
          serving={serving}
          pendingEntryId={pendingEntryId}
          onServeNext={onServeNext}
          onAttend={(entryId) => onEntry(entryId, "attend")}
        />
        <WaitingList
          waiting={view.waiting}
          pendingEntryId={pendingEntryId}
          onCall={(entryId) => onEntry(entryId, "serve")}
          onAttend={(entryId) => onEntry(entryId, "attend")}
          onSkip={(entry) => onConfirm({ kind: "skip", entry })}
        />
      </div>
      <QueueControls
        queue={view.queue}
        isOwner={isOwner}
        pendingAction={pendingAction}
        onAct={onQueue}
        onConfirm={onConfirm}
      />
    </div>
  );
}

function CounterHeading(): JSX.Element {
  const now = useNow(60_000);
  const today = new Date(now).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <h2 className="text-[clamp(30px,6vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
        Counter
      </h2>
      <p className="mt-2 text-[13px] text-muted" suppressHydrationWarning>
        {today}
      </p>
    </div>
  );
}

function Stats({ view }: { view: OperatorView }): JSX.Element {
  const last = view.waiting.at(-1);
  const backOfLine = view.waiting.length === 0 ? "No wait" : (last?.estimate?.label ?? "—");

  return (
    <dl className="grid grid-cols-2 border-y border-shell-line sm:grid-cols-4">
      <Stat label="Waiting" value={String(view.waitingCount)} />
      <Stat label="Wait at the back" value={backOfLine} />
      <Stat label="Average service" value={String(view.queue.averageServiceMinutes)} unit="min" />
      <Stat label="At the counter" value={view.serving ? String(view.serving.number) : "—"} />
    </dl>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }): JSX.Element {
  return (
    <div className="border-l border-shell-line px-5 py-4 first:border-l-0 first:pl-0 sm:[&:nth-child(3)]:border-l max-sm:[&:nth-child(3)]:border-l-0 max-sm:[&:nth-child(3)]:pl-0 max-sm:[&:nth-child(n+3)]:border-t">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="numeral mt-1.5 whitespace-nowrap text-[24px] text-strong sm:text-[28px]">
        {value}
        {unit && <span className="ml-1 font-sans text-[13px] tracking-normal text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

function AtTheCounter({
  view,
  serving,
  pendingEntryId,
  onServeNext,
  onAttend,
}: {
  view: OperatorView;
  serving: boolean;
  pendingEntryId: string | null;
  onServeNext: () => Promise<void>;
  onAttend: (entryId: string) => void;
}): JSX.Element {
  const now = useNow();
  const next = view.waiting[0];
  const current = view.serving;

  // The same request does both halves: it attends whoever is at the counter and
  // promotes the next number. With nobody waiting only the first half happens,
  // so the button stays live and says what it will actually do — otherwise the
  // last customer of the day could never be closed out from here.
  const label = next
    ? `Serve next · ${next.number}`
    : current
      ? `Finish with ${nameFor(current)}`
      : "Serve next";

  return (
    <section aria-labelledby="counter-heading" className="flex min-w-0 flex-col">
      <h3 id="counter-heading" className="text-[12.5px] text-muted">
        At the counter
      </h3>

      {/* Height reserved in both states so promoting a customer never shifts
          the Serve Next button under the operator's cursor. */}
      <div role="status" aria-live="polite" className="mt-3 flex min-h-[170px] flex-col justify-end">
        {current ? (
          <>
            {/* The one colour on the screen: this number is being called, the
                same vermilion the customer's phone has turned. */}
            <Numeral value={current.number} scale="next" className="text-signal" />
            <p className="mt-4 text-[22px] font-medium leading-tight tracking-[-0.02em] text-strong">
              {nameFor(current)}
            </p>
            <p className="mt-1 text-[13px] text-muted" suppressHydrationWarning>
              {current.startedAt && `Called ${minutesSince(current.startedAt, now)} min ago`}
              {current.startedAt && " · "}
              waited {minutesSince(current.joinedAt, now)} min
            </p>
          </>
        ) : (
          <p className="text-[24px] font-medium leading-tight tracking-[-0.02em] text-muted">
            {next ? "Ready when you are." : "Nobody in the queue."}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          variant="contrast"
          size="md"
          loading={serving}
          disabled={!next && !current}
          onClick={() => void onServeNext()}
        >
          <span className="truncate">{label}</span>
        </Button>

        {/* Finishing with someone without calling the next customer. Serve
            next does both in one press and is the button for the busy case;
            this is for the end of a run, when nobody should be called up. */}
        {current && next && (
          <Button
            variant="ghost"
            size="md"
            loading={pendingEntryId === current.id}
            onClick={() => onAttend(current.id)}
          >
            Done, nobody next
          </Button>
        )}
      </div>

      {!next && current && (
        <p className="mt-3 text-[13px] text-muted">Nobody else is waiting.</p>
      )}
    </section>
  );
}

function WaitingList({
  waiting,
  pendingEntryId,
  onCall,
  onAttend,
  onSkip,
}: {
  waiting: WaitingRow[];
  pendingEntryId: string | null;
  onCall: (entryId: string) => void;
  onAttend: (entryId: string) => void;
  onSkip: (entry: WaitingRow) => void;
}): JSX.Element {
  const now = useNow();
  const [query, setQuery] = useState("");
  const findRef = useRef<HTMLInputElement>(null);
  const findId = useId();

  // ⌘K / Ctrl+K puts the cursor in the finder. It is the one shortcut on the
  // counter, and it is the one a busy operator reaches for.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        findRef.current?.focus();
        findRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? waiting.filter(
        (entry) =>
          String(entry.number).includes(needle) || nameFor(entry).toLowerCase().includes(needle),
      )
    : waiting;

  return (
    <section aria-labelledby="waiting-heading" className="min-w-0">
      <div className="flex items-center justify-between gap-4">
        <h3 id="waiting-heading" className="text-[12.5px] text-muted">
          Waiting · {waiting.length}
        </h3>
        <label htmlFor={findId} className="relative block w-full max-w-[220px]">
          <span className="sr-only">Find a name or number</span>
          <Icon icon={Search} size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={findRef}
            id={findId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find"
            className="h-8 w-full rounded-full border border-shell-line bg-shell-soft pl-8 pr-10 text-[13px] text-strong placeholder:text-muted focus:border-strong focus:outline-none"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[4px] border border-shell-line px-1 text-[10.5px] text-muted">
            ⌘K
          </kbd>
        </label>
      </div>

      {waiting.length === 0 ? (
        <p className="mt-6 text-[13.5px] leading-[1.6] text-muted">
          No one is waiting. Share the queue and customers appear here.
        </p>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-[13.5px] leading-[1.6] text-muted">Nobody matches “{query}”.</p>
      ) : (
        <ul className="mt-3 flex flex-col border-t border-shell-line">
          {shown.map((entry) => (
            <li
              key={entry.id}
              className="animate-row-in grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-shell-line py-2.5 sm:grid-cols-[48px_minmax(0,1fr)_auto_auto] sm:gap-4"
            >
              <Numeral
                value={entry.number}
                scale="board"
                animateOnChange={false}
                className="text-strong"
              />
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[14.5px] font-medium text-strong">{nameFor(entry)}</span>
                {entry.id === waiting[0]?.id && (
                  <span className="shrink-0 rounded-full border border-shell-line px-2 py-px text-[11.5px] text-muted">
                    Next
                  </span>
                )}
              </span>
              <span className="hidden text-[12.5px] tabular-nums text-muted sm:block" suppressHydrationWarning>
                {minutesSince(entry.joinedAt, now)} min
              </span>
              <span className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  loading={pendingEntryId === entry.id}
                  onClick={() => onCall(entry.id)}
                >
                  Call now
                </Button>
                <RowMenu
                  entry={entry}
                  disabled={pendingEntryId === entry.id}
                  onCall={() => onCall(entry.id)}
                  onAttend={() => onAttend(entry.id)}
                  onSkip={() => onSkip(entry)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The rest of a row's actions, one deliberate step away. Skip is the
 * exception, not the rule, so it does not sit at the same weight as Call.
 * The button is always drawn — hover would hide it from every tablet.
 */
function RowMenu({
  entry,
  disabled,
  onCall,
  onAttend,
  onSkip,
}: {
  entry: WaitingRow;
  disabled: boolean;
  onCall: () => void;
  onAttend: () => void;
  onSkip: () => void;
}): JSX.Element {
  const { open, setOpen, toggle, containerRef, triggerRef, panelId } = useDisclosure();

  const item =
    "flex w-full items-center rounded-[7px] px-2.5 py-2 text-left text-[13.5px] text-strong transition-colors hover:bg-shell-mid";

  return (
    <span ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`More for ${nameFor(entry)}`}
        onClick={toggle}
        className={cn(
          "grid size-8 place-items-center rounded-full border border-transparent text-muted transition-colors",
          "hover:border-shell-line hover:text-strong disabled:opacity-50",
          open && "border-shell-line bg-shell-mid text-strong",
        )}
      >
        <Icon icon={MoreHorizontal} size={16} />
      </button>
      <span
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-20 mt-1 block w-[184px] rounded-[10px] border border-shell-line bg-shell-soft p-1 shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_12px_32px_rgb(0_0_0_/_0.10)]"
      >
        <button type="button" className={item} onClick={() => { setOpen(false); onCall(); }}>
          Call now
        </button>
        <button type="button" className={item} onClick={() => { setOpen(false); onAttend(); }}>
          Mark as served
        </button>
        <span className="my-1 block h-px bg-shell-line" />
        <button type="button" className={cn(item, "text-dim")} onClick={() => { setOpen(false); onSkip(); }}>
          Skip…
        </button>
      </span>
    </span>
  );
}

/**
 * The controls an operator reaches for a few times a day rather than a few
 * times a minute. Pausing is shared with operators and stays in the open;
 * closing and clearing end the day, belong to the owner, and sit behind a
 * disclosure — a confirm dialog alone is weak protection against a
 * fat-finger on a counter tablet.
 */
function QueueControls({
  queue,
  isOwner,
  pendingAction,
  onAct,
  onConfirm,
}: {
  queue: Queue;
  isOwner: boolean;
  pendingAction: QueueAction | null;
  onAct: (action: QueueAction) => void;
  onConfirm: (confirmation: Confirmation) => void;
}): JSX.Element {
  const closed = queue.status === "CLOSED";
  const paused = queue.status === "PAUSED";

  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== "Escape" || !moreOpen) return;
    setMoreOpen(false);
    toggleRef.current?.focus();
  }

  const line = paused
    ? "Paused: nobody new can join. Everyone waiting keeps their place."
    : closed
      ? "Closed: nobody new can join. Everyone waiting keeps their place."
      : "New customers can join by scanning the code.";

  return (
    <section
      aria-labelledby="controls-heading"
      onKeyDown={onKeyDown}
      className="border-t border-shell-line pt-6"
    >
      <h3 id="controls-heading" className="sr-only">
        Queue controls
      </h3>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="inline-flex items-center gap-2 text-[13.5px] font-medium text-strong">
          <StatusDot status={queue.status} />
          {closed ? "Queue is closed" : paused ? "Queue is paused" : "Queue is open"}
        </span>
        <p className="text-[13.5px] text-muted">{line}</p>

        <div className="ml-auto flex items-center gap-2">
          {closed ? (
            <Button
              variant="contrast"
              size="md"
              loading={pendingAction === "resume"}
              onClick={() => onAct("resume")}
            >
              Reopen queue
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="md"
              loading={pendingAction === (paused ? "resume" : "pause")}
              onClick={() => onAct(paused ? "resume" : "pause")}
            >
              {paused ? "Resume queue" : "Pause queue"}
            </Button>
          )}

          {isOwner && (
            <button
              ref={toggleRef}
              type="button"
              aria-expanded={moreOpen}
              aria-controls={moreId}
              onClick={() => setMoreOpen((open) => !open)}
              className={controlClasses("ghost", "md")}
            >
              More<span className="sr-only"> queue actions</span>
              <Icon icon={ChevronDown} size={14} className={cn("transition-transform", moreOpen && "rotate-180")} />
            </button>
          )}
        </div>
      </div>

      {/* Inline, so it pushes the page down rather than floating over it.
          Kept in the DOM and hidden so aria-controls always resolves. */}
      {isOwner && (
        <div id={moreId} hidden={!moreOpen} className="mt-5 border-t border-shell-line pt-5">
          <div className="flex flex-col gap-4">
            {!closed && (
              <DestructiveAction
                label="Close queue"
                description="Stops anyone new joining. Everyone already waiting keeps their place, and you can reopen whenever you like."
                onClick={() => onConfirm({ kind: "close" })}
              />
            )}
            <DestructiveAction
              label="Clear queue"
              description="Removes everyone waiting and starts numbering again at 1. Today's history is kept."
              onClick={() => onConfirm({ kind: "reset" })}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/** One action behind the disclosure, with the line that says what it does. */
function DestructiveAction({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <Button variant="ghost" size="md" onClick={onClick} className="shrink-0 self-start sm:self-auto">
        {label}
      </Button>
      <p className="text-[13.5px] leading-[1.6] text-muted">{description}</p>
    </div>
  );
}
