"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type JSX } from "react";
import { MoreHorizontal, Plus, Search, X } from "lucide-react";
import { Field } from "@/components/Field";
import { Button, controlClasses } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Numeral } from "@/components/Numeral";
import { useDisclosure } from "@/hooks/useDisclosure";
import { minutesSince, useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import { StatusDot } from "./QueueSwitcher";
import type {
  EntryAction,
  OperatorView,
  Presence,
  Queue,
  QueueAction,
  QueueEntry,
  WaitingRow,
} from "@/lib/types";

/**
 * What the operator is being asked to confirm, if anything. A dialog on skip,
 * close and reset — and deliberately not on serve next, which is the action
 * they take all day.
 */
export type Confirmation =
  | { kind: "skip"; entry: QueueEntry }
  | { kind: "close" }
  | { kind: "reset" }
  | null;

interface CounterProps {
  view: OperatorView;
  isOwner: boolean;
  serving: boolean;
  pendingEntryId: string | null;
  pendingAction: QueueAction | null;
  /** The finder's text. Owned above so the chrome's top row can hold the input. */
  query: string;
  onQuery: (query: string) => void;
  onServeNext: () => Promise<void>;
  onEntry: (entryId: string, action: EntryAction) => void;
  /** Pause carries an optional note for the people who scan in meanwhile. */
  onQueue: (action: QueueAction, note?: string) => void;
  onConfirm: (confirmation: Confirmation) => void;
  /** Put somebody in the queue from the counter. Resolves false if it did not go through. */
  onAddWalkIn: (name: string) => Promise<boolean>;
  addingWalkIn: boolean;
}

/** A row's name, or the number said as a name when the queue keeps names to its owner. */
function nameFor(entry: { customerName: string; number: number }): string {
  return entry.customerName || `Customer ${entry.number}`;
}

/** The two minutes a customer can ask for on top of the hold, from the pass. */
const HOLD_REQUEST_MINUTES = 2;

/**
 * What a skip means on this queue, in one clause, for every place that has
 * to say it. With no hold time a skip is final.
 */
export function skipConsequence(holdMinutes: number): string {
  return holdMinutes > 0
    ? `They keep their number for ${holdMinutes} minutes and you can call them back from the list.`
    : "They leave the queue and can rejoin for a new number.";
}

/**
 * What the customer said about where they are, as a tag. "Here" is filled
 * because it is the one the operator acts on; the others are quieter.
 */
function PresenceTag({ presence }: { presence: Presence | null }): JSX.Element | null {
  if (!presence) return null;
  const word = presence === "HERE" ? "Here" : presence === "ON_THE_WAY" ? "On my way" : "Asked for 2 min";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11.5px] font-medium",
        presence === "HERE"
          ? "border-strong bg-strong text-shell"
          : "border-shell-line text-dim",
      )}
    >
      {word}
    </span>
  );
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
  query,
  onQuery,
  onServeNext,
  onEntry,
  onQueue,
  onConfirm,
  onAddWalkIn,
  addingWalkIn,
}: CounterProps): JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <CounterHeading
        queue={view.queue}
        isOwner={isOwner}
        pendingAction={pendingAction}
        onAct={onQueue}
        onConfirm={onConfirm}
        onAddWalkIn={onAddWalkIn}
        addingWalkIn={addingWalkIn}
      />
      <Stats view={view} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] 2xl:gap-24">
        <AtTheCounter
          view={view}
          serving={serving}
          pendingEntryId={pendingEntryId}
          onServeNext={onServeNext}
          onAttend={(entryId) => onEntry(entryId, "attend")}
          onSkip={(entry) => onConfirm({ kind: "skip", entry })}
        />
        <WaitingList
          waiting={view.waiting}
          query={query}
          onQuery={onQuery}
          pendingEntryId={pendingEntryId}
          onCall={(entryId) => onEntry(entryId, "serve")}
          onAttend={(entryId) => onEntry(entryId, "attend")}
          onSkip={(entry) => onConfirm({ kind: "skip", entry })}
          skipped={view.skipped}
          onRecall={(entryId) => onEntry(entryId, "serve")}
          holdMinutes={view.queue.holdMinutes}
        />
      </div>
      <QueueStatusLine queue={view.queue} />
    </div>
  );
}

/**
 * The heading, the date, and the controls an operator reaches for a few
 * times a day: pause, and for owners the end-of-day actions behind More.
 */
function CounterHeading({
  queue,
  isOwner,
  pendingAction,
  onAct,
  onConfirm,
  onAddWalkIn,
  addingWalkIn,
}: {
  queue: Queue;
  isOwner: boolean;
  pendingAction: QueueAction | null;
  onAct: (action: QueueAction, note?: string) => void;
  onConfirm: (confirmation: Confirmation) => void;
  onAddWalkIn: (name: string) => Promise<boolean>;
  addingWalkIn: boolean;
}): JSX.Element {
  const now = useNow(60_000);
  const today = new Date(now).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div>
        <h2 className="text-[clamp(30px,6vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
          Counter
        </h2>
        <p className="mt-2 text-[13px] text-muted" suppressHydrationWarning>
          {today}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AddWalkIn onAdd={onAddWalkIn} adding={addingWalkIn} disabled={queue.status === "CLOSED"} />
        <QueueControls
          queue={queue}
          isOwner={isOwner}
          pendingAction={pendingAction}
          onAct={onAct}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}

/**
 * Somebody at the counter without a phone, or with a phone that will not
 * scan. Staff type a name and they get the next number; the number is said
 * aloud or written on a slip, since nothing can recover it on a device.
 */
function AddWalkIn({
  onAdd,
  adding,
  disabled,
}: {
  onAdd: (name: string) => Promise<boolean>;
  adding: boolean;
  disabled: boolean;
}): JSX.Element {
  const { open, setOpen, toggle, containerRef, triggerRef, panelId } = useDisclosure();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter their name");
      return;
    }
    setError(null);
    if (await onAdd(trimmed)) {
      setName("");
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={cn(controlClasses("ghost", "md"), "disabled:opacity-50")}
      >
        <Icon icon={Plus} size={15} />
        Add a person
      </button>
      <form
        id={panelId}
        hidden={!open}
        onSubmit={onSubmit}
        noValidate
        className="absolute right-0 top-full z-20 mt-1.5 w-[300px] rounded-[12px] border border-shell-line bg-shell-soft p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_12px_32px_rgb(0_0_0_/_0.10)]"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[14px] font-medium text-strong">Add a person to the queue</p>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="grid size-6 place-items-center rounded-full text-muted hover:text-strong"
          >
            <Icon icon={X} size={14} />
          </button>
        </div>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">
          They take the next number. Tell them what it is, since there is no phone to show it on.
        </p>
        <Field
          className="mt-3"
          label="Their name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={error}
          placeholder="First name is enough"
          maxLength={60}
          autoComplete="off"
          autoFocus={open}
        />
        <Button type="submit" variant="contrast" size="md" loading={adding} className="mt-3 w-full">
          Give them a number
        </Button>
      </form>
    </div>
  );
}

/** One line under everything: whether the queue is taking people. */
function QueueStatusLine({ queue }: { queue: Queue }): JSX.Element {
  const closed = queue.status === "CLOSED";
  const paused = queue.status === "PAUSED";
  const line = paused
    ? "Paused: nobody new can join. Everyone waiting keeps their place."
    : closed
      ? "Closed: nobody new can join. Everyone waiting keeps their place."
      : "New customers can join by scanning the code.";

  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-shell-line pt-5 text-[13.5px] text-muted">
      <span className="inline-flex items-center gap-2 font-medium text-strong">
        <StatusDot status={queue.status} />
        {closed ? "Queue is closed" : paused ? "Queue is paused" : "Queue is open"}
      </span>
      {line}
      {/* The note customers are reading, so the counter knows what was promised. */}
      {paused && queue.pauseNote && (
        <span className="text-strong">&ldquo;{queue.pauseNote}&rdquo;</span>
      )}
    </p>
  );
}

/**
 * The finder. Rendered in the chrome's top row on a desktop and in the list's
 * own header on a phone, from the same text, so ⌘K lands in whichever is on
 * screen.
 */
export function Finder({
  query,
  onQuery,
  className,
}: {
  query: string;
  onQuery: (query: string) => void;
  className?: string;
}): JSX.Element {
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();

  // ⌘K / Ctrl+K puts the cursor here. It is the one shortcut on the counter,
  // and it is the one a busy operator reaches for.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        const input = ref.current;
        if (!input || input.offsetParent === null) return;
        event.preventDefault();
        input.focus();
        input.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <label htmlFor={id} className={cn("relative block w-full", className)}>
      <span className="sr-only">Find a customer or number</span>
      <Icon icon={Search} size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        id={id}
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Find a customer or number"
        className="h-9 w-full rounded-full border border-shell-line bg-shell-soft pl-9 pr-11 text-[13px] text-strong placeholder:text-muted focus:border-strong focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-[4px] border border-shell-line px-1 text-[10.5px] text-muted">
        ⌘K
      </kbd>
    </label>
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
  onSkip,
}: {
  view: OperatorView;
  serving: boolean;
  pendingEntryId: string | null;
  onServeNext: () => Promise<void>;
  onAttend: (entryId: string) => void;
  onSkip: (entry: QueueEntry) => void;
}): JSX.Element {
  const now = useNow();
  const next = view.waiting[0];
  const current = view.serving;
  const hold = view.queue.holdMinutes;

  // The hold time doing its first job: once a called person has been silent
  // for longer than the queue holds a place, the counter says so. "Here"
  // cancels it, and a two-minute request from the pass adds two minutes.
  const sinceCalled = current?.startedAt ? minutesSince(current.startedAt, now) : 0;
  const grace = hold + (current?.presence === "HOLD" ? HOLD_REQUEST_MINUTES : 0);
  const overdue = hold > 0 && current !== null && current.presence !== "HERE" && sinceCalled >= grace;

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
      <div role="status" aria-live="polite" className="mt-3 flex min-h-[170px] flex-col justify-end 2xl:min-h-[220px]">
        {current ? (
          <>
            {/* The one colour on the screen: this number is being called, the
                same vermilion the customer's phone has turned. */}
            <Numeral value={current.number} scale="next" className="text-signal 2xl:text-[200px]" />
            <p className="mt-4 flex items-center gap-2.5 text-[22px] font-medium leading-tight tracking-[-0.02em] text-strong">
              {nameFor(current)}
              <PresenceTag presence={current.presence} />
            </p>
            <p className="mt-1 text-[13px] text-muted" suppressHydrationWarning>
              {current.startedAt && `Called ${minutesSince(current.startedAt, now)} min ago`}
              {current.startedAt && " · "}
              waited {minutesSince(current.joinedAt, now)} min
            </p>
            {overdue ? (
              <p className="mt-2 text-[13px] leading-[1.55] text-strong" suppressHydrationWarning>
                No sign of them for {sinceCalled} min. Skipping frees the counter.{" "}
                {skipConsequence(hold)}
              </p>
            ) : (
              current.presence === "HOLD" &&
              current.presenceAt && (
                <p className="mt-2 text-[13px] leading-[1.55] text-dim" suppressHydrationWarning>
                  Asked for two minutes {minutesSince(current.presenceAt, now)} min ago.
                </p>
              )
            )}
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
        {/* Standing down the person at the counter. With a hold time they
            keep their number and show under the list to be called back. */}
        {current && (
          <Button
            variant={overdue ? "contrast" : "ghost"}
            size="md"
            disabled={pendingEntryId === current.id}
            onClick={() => onSkip(current)}
          >
            {hold > 0 ? "Skip and hold" : "Skip"}
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
  query,
  onQuery,
  pendingEntryId,
  onCall,
  onAttend,
  onSkip,
  skipped,
  onRecall,
  holdMinutes,
}: {
  waiting: WaitingRow[];
  query: string;
  onQuery: (query: string) => void;
  pendingEntryId: string | null;
  onCall: (entryId: string) => void;
  onAttend: (entryId: string) => void;
  onSkip: (entry: WaitingRow) => void;
  skipped: QueueEntry[];
  onRecall: (entryId: string) => void;
  holdMinutes: number;
}): JSX.Element {
  const now = useNow();

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
        <Finder query={query} onQuery={onQuery} className="max-w-[240px] lg:hidden" />
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
              className="animate-row-in grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-shell-line py-2.5 sm:grid-cols-[48px_minmax(0,1fr)_auto_auto] sm:gap-4 2xl:py-3.5"
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
                {entry.walkIn && (
                  <span className="shrink-0 rounded-full border border-shell-line px-2 py-px text-[11.5px] text-muted">
                    Walk-in
                  </span>
                )}
                <PresenceTag presence={entry.presence} />
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

      {skipped.length > 0 && (
        <SkippedList skipped={skipped} pendingEntryId={pendingEntryId} onRecall={onRecall} now={now} holdMinutes={holdMinutes} />
      )}
    </section>
  );
}

/**
 * The people stood down in the last half hour. The most common thing after
 * a skip is the person appearing, and calling them back keeps their number.
 */
function SkippedList({
  skipped,
  pendingEntryId,
  onRecall,
  now,
  holdMinutes,
}: {
  skipped: QueueEntry[];
  pendingEntryId: string | null;
  onRecall: (entryId: string) => void;
  now: number;
  holdMinutes: number;
}): JSX.Element | null {
  // With no hold time the server lists nobody, and with nothing listed there
  // is no section to draw.
  if (holdMinutes <= 0 || skipped.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="text-[12.5px] text-muted">
        Skipped recently <span className="text-faint">· kept for {holdMinutes} min</span>
      </h3>
      <ul className="mt-2 flex flex-col border-t border-shell-line">
        {skipped.map((entry) => (
          <li
            key={entry.id}
            className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-shell-line py-2.5 sm:gap-4"
          >
            <Numeral value={entry.number} scale="board" animateOnChange={false} className="text-muted" />
            <span className="min-w-0 truncate text-[14px] text-dim">
              {nameFor(entry)}
              {entry.completedAt && (
                <span className="text-muted" suppressHydrationWarning>
                  {" "}· skipped {minutesSince(entry.completedAt, now)} min ago
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              loading={pendingEntryId === entry.id}
              onClick={() => onRecall(entry.id)}
            >
              Call now
            </Button>
          </li>
        ))}
      </ul>
    </div>
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
 * Pause, shared with operators, in the open; close and clear, the owner's
 * end-of-day actions, behind a disclosure — a confirm dialog alone is weak
 * protection against a fat-finger on a counter tablet.
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
  onAct: (action: QueueAction, note?: string) => void;
  onConfirm: (confirmation: Confirmation) => void;
}): JSX.Element {
  const closed = queue.status === "CLOSED";
  const paused = queue.status === "PAUSED";
  const { open, setOpen, toggle, containerRef, triggerRef, panelId } = useDisclosure();

  return (
    <div className="flex items-center gap-2">
      {closed ? (
        <Button
          variant="contrast"
          size="md"
          loading={pendingAction === "resume"}
          onClick={() => onAct("resume")}
        >
          Reopen queue
        </Button>
      ) : paused ? (
        <Button
          variant="ghost"
          size="md"
          loading={pendingAction === "resume"}
          onClick={() => onAct("resume")}
        >
          Resume queue
        </Button>
      ) : (
        <PauseControl pending={pendingAction === "pause"} onPause={(note) => onAct("pause", note)} />
      )}

      <div ref={containerRef} className="relative flex items-center">

      {isOwner && (
        <>
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label="More queue actions"
            onClick={toggle}
            className={cn(controlClasses("ghost", "md"), "px-3")}
          >
            <Icon icon={MoreHorizontal} size={16} />
          </button>
          <div
            id={panelId}
            hidden={!open}
            className="absolute right-0 top-full z-20 mt-1.5 w-[300px] rounded-[12px] border border-shell-line bg-shell-soft p-1.5 shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_12px_32px_rgb(0_0_0_/_0.10)]"
          >
            {!closed && (
              <DestructiveAction
                label="Close queue"
                description="Stops anyone new joining. Everyone waiting keeps their place, and you can reopen whenever you like."
                onClick={() => {
                  setOpen(false);
                  onConfirm({ kind: "close" });
                }}
              />
            )}
            <DestructiveAction
              label="Clear queue"
              description="Removes everyone waiting and starts numbering again at 1. Today's history is kept."
              onClick={() => {
                setOpen(false);
                onConfirm({ kind: "reset" });
              }}
            />
          </div>
        </>
      )}
      </div>
    </div>
  );
}

/**
 * Pausing, with room for one line the customers will read: "Back at 2:30".
 * The line is optional and the button pauses either way, so a lunch break
 * costs one tap and a proper break costs two.
 */
function PauseControl({
  pending,
  onPause,
}: {
  pending: boolean;
  onPause: (note: string) => void;
}): JSX.Element {
  const { open, setOpen, toggle, containerRef, triggerRef, panelId } = useDisclosure();
  const [note, setNote] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onPause(note.trim());
    setNote("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={controlClasses("ghost", "md")}
      >
        {pending ? "Pausing…" : "Pause queue"}
      </button>
      <form
        id={panelId}
        hidden={!open}
        onSubmit={onSubmit}
        noValidate
        className="absolute right-0 top-full z-20 mt-1.5 w-[300px] rounded-[12px] border border-shell-line bg-shell-soft p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_12px_32px_rgb(0_0_0_/_0.10)]"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[14px] font-medium text-strong">Pause the queue</p>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="grid size-6 place-items-center rounded-full text-muted hover:text-strong"
          >
            <Icon icon={X} size={14} />
          </button>
        </div>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">
          Nobody new can join. Everyone waiting keeps their place.
        </p>
        <Field
          className="mt-3"
          label="Say when you're back"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          hint="Optional. Shown to customers and on the wall."
          placeholder="Back at 2:30"
          maxLength={80}
          autoComplete="off"
          autoFocus={open}
        />
        <Button type="submit" variant="contrast" size="md" loading={pending} className="mt-3 w-full">
          Pause
        </Button>
      </form>
    </div>
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
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-[8px] px-3 py-2.5 text-left transition-colors hover:bg-shell-mid"
    >
      <span className="block text-[13.5px] font-medium text-strong">{label}</span>
      <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-muted">{description}</span>
    </button>
  );
}
