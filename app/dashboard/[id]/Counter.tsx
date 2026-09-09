"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type JSX } from "react";
import { ChevronDown, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { Field } from "@/components/Field";
import { Button, controlClasses } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Numeral } from "@/components/Numeral";
import { useDisclosure } from "@/hooks/useDisclosure";
import { minutesSince, useNow } from "@/hooks/useNow";
import { readyChairs, type Chair } from "@/lib/seats";
import { cn } from "@/lib/utils";
import { StatusDot } from "./QueueSwitcher";
import { ChairCard } from "./ChairCard";
import { ChairRail } from "./ChairRail";
import { SeatPicker } from "./SeatPicker";
import { MEASURE_SAMPLE } from "@/lib/types";
import type {
  EntryAction,
  OperatorView,
  Presence,
  Queue,
  QueueAction,
  QueueEntry,
  UpdateSeatInput,
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
  /** The signed-in person's id, for telling their chair from the others. */
  principalId: string | null;
  serving: boolean;
  pendingEntryId: string | null;
  pendingAction: QueueAction | null;
  pendingSeatId: string | null;
  /** The finder's text. Owned above so the chrome's top row can hold the input. */
  query: string;
  onQuery: (query: string) => void;
  /** Every chair with whoever is on it, in order. */
  chairs: Chair[];
  /** The chair open as the counter card. Null only on a queue with no seats. */
  openChair: Chair | null;
  canOpenChair: (chair: Chair) => boolean;
  onOpenChair: (seatId: string) => void;
  /** The All chairs page, for whoever may see every chair. */
  allChairsHref?: string;
  onServeNext: (seatId: string) => Promise<void>;
  /** The seat rides along with "serve" only: it is where the call lands. */
  onEntry: (entryId: string, action: EntryAction, seatId?: string) => void;
  /** Pause carries an optional note for the people who scan in meanwhile. */
  onQueue: (action: QueueAction, note?: string) => void;
  onConfirm: (confirmation: Confirmation) => void;
  /** Put somebody in the queue from the counter. Resolves false if it did not go through. */
  onAddWalkIn: (name: string) => Promise<boolean>;
  addingWalkIn: boolean;
  onTake: (seatId: string) => void;
  onLeave: (seatId: string) => void;
  onSetOpen: (seatId: string, active: boolean) => void;
  onAssign: (seatId: string, worker: UpdateSeatInput["worker"]) => void;
  token: string | null;
}

/** A row's name, or the number said as a name when the queue keeps names to its owner. */
export function nameFor(entry: { customerName: string; number: number }): string {
  return entry.customerName || `Customer ${entry.number}`;
}

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
export function PresenceTag({ presence }: { presence: Presence | null }): JSX.Element | null {
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
 * Where a call can land right now, and why not when it cannot.
 *
 * On a one-seat queue the counter is the target, and calling is off only
 * while somebody is being served there — a person merely called is stood
 * down by the call, as it always was. With several chairs a call lands
 * only on a ready chair: open, worked, nobody on it. Staff aim at their own
 * chair alone; the owner at any ready one.
 */
interface CallTargets {
  chairs: Chair[];
  /** Said in words when there is nowhere to call to. */
  reason: string | null;
  /** The line over the list saying where Call now goes. */
  hint: string | null;
}

function callTargets(
  view: OperatorView,
  chairs: Chair[],
  single: boolean,
  isOwner: boolean,
  mine: Chair | null,
  seatsFixed: boolean,
): CallTargets {
  if (single) {
    const only = chairs[0];
    if (!only) return { chairs: [], reason: "This queue has no chair to call people to.", hint: null };
    if (only.state === "closed") return { chairs: [], reason: "Open the counter before calling anyone.", hint: null };
    const busyWith = view.serving?.servedAt ? nameFor(view.serving) : null;
    if (busyWith) return { chairs: [], reason: `Finish with ${busyWith} before calling anyone else.`, hint: null };
    return { chairs: [only], reason: null, hint: null };
  }

  if (!isOwner) {
    if (!mine) {
      return {
        chairs: [],
        reason: seatsFixed ? "Ask the owner for a chair before calling anyone." : "Pick a chair to call people to.",
        hint: null,
      };
    }
    if (mine.state !== "ready") {
      const name = mine.entry ? nameFor(mine.entry) : "them";
      return { chairs: [], reason: `Finish with ${name} before calling anyone to ${mine.seat.name}.`, hint: null };
    }
    return { chairs: [mine], reason: null, hint: `Call now sends people to ${mine.seat.name}.` };
  }

  const ready = readyChairs(chairs);
  if (ready.length === 0) {
    const idle = chairs.some((chair) => chair.state === "unstaffed");
    return {
      chairs: [],
      reason: idle
        ? "No chair is ready. Take a chair, or give one to somebody, to call people to it."
        : "Every chair is busy. Finish with somebody first.",
      hint: null,
    };
  }
  if (ready.length === 1) {
    return { chairs: ready, reason: null, hint: `${ready[0].seat.name} is free, so Call now sends people there.` };
  }
  const names = ready.map((chair) => chair.seat.name);
  const list = `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return { chairs: ready, reason: null, hint: `${list} are ready, so Call now asks which.` };
}

/**
 * The working screen. With one seat: the person at the counter, one button
 * for the next one, and the waiting list as a ledger with one visible
 * action per row. With several: the same, with a rail of chairs above and
 * whichever chair is open as the card.
 */
export function Counter({
  view,
  isOwner,
  principalId,
  serving,
  pendingEntryId,
  pendingAction,
  pendingSeatId,
  query,
  onQuery,
  chairs,
  openChair,
  canOpenChair,
  onOpenChair,
  allChairsHref,
  onServeNext,
  onEntry,
  onQueue,
  onConfirm,
  onAddWalkIn,
  addingWalkIn,
  onTake,
  onLeave,
  onSetOpen,
  onAssign,
  token,
}: CounterProps): JSX.Element {
  const single = chairs.length <= 1;
  const mine = chairs.find((chair) => chair.seat.worker && isOwnChair(chair, isOwner, principalId)) ?? null;
  const targets = callTargets(view, chairs, single, isOwner, mine, view.queue.seatsFixed);

  return (
    <div className="@container flex flex-col gap-8">
      <CounterHeading
        queue={view.queue}
        isOwner={isOwner}
        pendingAction={pendingAction}
        onAct={onQueue}
        onConfirm={onConfirm}
        onAddWalkIn={onAddWalkIn}
        addingWalkIn={addingWalkIn}
        picker={
          single ? null : (
            <SeatPicker
              chairs={chairs}
              isOwner={isOwner}
              principalId={principalId}
              seatsFixed={view.queue.seatsFixed}
              pending={pendingSeatId !== null}
              onTake={onTake}
              onLeave={onLeave}
            />
          )
        }
      />
      <Stats view={view} chairs={chairs} single={single} />

      {!single && (
        <ChairRail
          chairs={chairs}
          openSeatId={openChair?.seat.id ?? null}
          canOpen={canOpenChair}
          onOpen={onOpenChair}
          allChairsHref={allChairsHref}
        />
      )}

      {/* Split on the content's own width rather than the window's: a 12.9"
          iPad held upright has the sidebar and not the room for two columns. */}
      <div className="grid gap-10 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] @3xl:gap-14 @6xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] @6xl:gap-24">
        {openChair ? (
          <ChairCard
            chair={openChair}
            next={view.waiting[0]}
            single={single}
            isOwner={isOwner}
            principalId={principalId}
            seatsFixed={view.queue.seatsFixed}
            holdMinutes={view.queue.holdMinutes}
            serving={serving}
            pendingEntryId={pendingEntryId}
            pendingSeatId={pendingSeatId}
            onServeNext={(seatId) => void onServeNext(seatId)}
            onAttend={(entryId) => onEntry(entryId, "attend")}
            onStart={(entryId) => onEntry(entryId, "start")}
            onSkip={(entry) => onConfirm({ kind: "skip", entry })}
            onTake={onTake}
            onLeave={onLeave}
            onSetOpen={onSetOpen}
            onAssign={onAssign}
            token={token}
          />
        ) : (
          <section className="min-w-0">
            <h3 className="text-[12.5px] text-muted">At the counter</h3>
            <p className="mt-3 text-[24px] font-medium leading-tight tracking-[-0.02em] text-muted">
              This queue has no chair yet.
            </p>
          </section>
        )}
        <WaitingList
          waiting={view.waiting}
          targets={targets}
          query={query}
          onQuery={onQuery}
          pendingEntryId={pendingEntryId}
          onCall={(entryId, seatId) => onEntry(entryId, "serve", seatId)}
          onAttend={(entryId) => onEntry(entryId, "attend")}
          onSkip={(entry) => onConfirm({ kind: "skip", entry })}
          skipped={view.skipped}
          holdMinutes={view.queue.holdMinutes}
          single={single}
        />
      </div>
      <QueueStatusLine queue={view.queue} />
    </div>
  );
}

function isOwnChair(chair: Chair, isOwner: boolean, principalId: string | null): boolean {
  const worker = chair.seat.worker;
  if (!worker) return false;
  return isOwner ? worker.type === "OWNER" : worker.type === "OPERATOR" && worker.operatorId === principalId;
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
  picker,
}: {
  queue: Queue;
  isOwner: boolean;
  pendingAction: QueueAction | null;
  onAct: (action: QueueAction, note?: string) => void;
  onConfirm: (confirmation: Confirmation) => void;
  onAddWalkIn: (name: string) => Promise<boolean>;
  addingWalkIn: boolean;
  /** Which chair you are at, on a queue with more than one. */
  picker: JSX.Element | null;
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
        {picker}
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
 * The finder. Not rendered anywhere for now — a counter of a dozen people
 * does not need one — and kept, wired, for the day a queue is long enough
 * to. It belongs in the chrome's top row on a desktop and in the list's own
 * header on a phone, from the same text, so ⌘K lands in whichever is on
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
        className="h-9 w-full rounded-full border border-shell-line bg-shell-soft pl-9 pr-11 text-[13px] text-strong placeholder:text-muted focus:border-strong focus:outline-none pointer-coarse:h-10 pointer-coarse:text-[16px]"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-[4px] border border-shell-line px-1 text-[10.5px] text-muted">
        ⌘K
      </kbd>
    </label>
  );
}

function Stats({ view, chairs, single }: { view: OperatorView; chairs: Chair[]; single: boolean }): JSX.Element {
  const last = view.waiting.at(-1);
  const backOfLine = view.waiting.length === 0 ? "No wait" : (last?.estimate?.label ?? "—");

  const arrival = view.arrival.sample > 0 ? String(view.arrival.minutes) : "—";
  const open = chairs.filter((chair) => chair.seat.active).length;

  return (
    <dl className="grid grid-cols-2 border-y border-shell-line sm:grid-cols-5">
      <Stat label="Waiting" value={String(view.waitingCount)} />
      <Stat label="Wait at the back" value={backOfLine} />
      {view.measured.sample >= MEASURE_SAMPLE ? (
        <Stat label="Service, measured" value={String(view.measured.minutes)} unit="min" />
      ) : (
        <Stat label="Average service" value={String(view.queue.averageServiceMinutes)} unit="min" />
      )}
      {/* How long people take to turn up once called, lately. The number a
          hold time should be longer than. */}
      <Stat label="Arrive after call" value={arrival} unit={arrival === "—" ? undefined : "min"} />
      {single ? (
        <Stat label="At the counter" value={view.serving ? String(view.serving.number) : "—"} />
      ) : (
        <Stat label="Chairs open" value={String(open)} unit={`of ${chairs.length}`} />
      )}
    </dl>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }): JSX.Element {
  return (
    <div className="border-l border-shell-line px-5 py-4 first:border-l-0 first:pl-0 max-sm:[&:nth-child(odd)]:border-l-0 max-sm:[&:nth-child(odd)]:pl-0 max-sm:[&:nth-child(n+3)]:border-t">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="numeral mt-1.5 whitespace-nowrap text-[24px] text-strong sm:text-[28px]">
        {value}
        {unit && <span className="ml-1 font-sans text-[13px] tracking-normal text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

function WaitingList({
  waiting,
  targets,
  query,
  onQuery,
  pendingEntryId,
  onCall,
  onAttend,
  onSkip,
  skipped,
  holdMinutes,
  single,
}: {
  waiting: WaitingRow[];
  targets: CallTargets;
  query: string;
  onQuery: (query: string) => void;
  pendingEntryId: string | null;
  onCall: (entryId: string, seatId: string) => void;
  onAttend: (entryId: string) => void;
  onSkip: (entry: WaitingRow) => void;
  skipped: QueueEntry[];
  holdMinutes: number;
  single: boolean;
}): JSX.Element {
  const now = useNow();

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? waiting.filter(
        (entry) =>
          String(entry.number).includes(needle) || nameFor(entry).toLowerCase().includes(needle),
      )
    : waiting;

  const anyone = waiting.length > 0 || skipped.length > 0;

  return (
    <section aria-labelledby="waiting-heading" className="min-w-0">
      <div className="flex items-center justify-between gap-4">
        <h3 id="waiting-heading" className="text-[12.5px] text-muted">
          Waiting · {waiting.length}
        </h3>
        {/* The finder is parked until the counter needs it; see Finder. */}
      </div>
      {/* Said in words as well as on hover: a tablet has no hover. */}
      {anyone && targets.reason !== null && (
        <p className="mt-2 text-[12.5px] text-muted">{targets.reason}</p>
      )}
      {anyone && targets.hint !== null && (
        <p className="mt-2 text-[12.5px] text-muted">{targets.hint}</p>
      )}

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
                <CallButton
                  targets={targets}
                  single={single}
                  loading={pendingEntryId === entry.id}
                  onCall={(seatId) => onCall(entry.id, seatId)}
                />
                <RowMenu
                  entry={entry}
                  targets={targets}
                  single={single}
                  disabled={pendingEntryId === entry.id}
                  onCall={(seatId) => onCall(entry.id, seatId)}
                  onAttend={() => onAttend(entry.id)}
                  onSkip={() => onSkip(entry)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      {skipped.length > 0 && (
        <SkippedList
          skipped={skipped}
          pendingEntryId={pendingEntryId}
          onRecall={onCall}
          now={now}
          holdMinutes={holdMinutes}
          targets={targets}
          single={single}
        />
      )}
    </section>
  );
}

/**
 * Call now, aimed. One target: the button says where. Several: it asks. None:
 * it is off, and the list above has said why.
 */
function CallButton({
  targets,
  single,
  loading,
  onCall,
}: {
  targets: CallTargets;
  single: boolean;
  loading: boolean;
  onCall: (seatId: string) => void;
}): JSX.Element {
  const { open, setOpen, toggle, containerRef, triggerRef, panelId } = useDisclosure();

  if (targets.chairs.length <= 1) {
    const only = targets.chairs[0];
    return (
      <Button
        variant="ghost"
        size="sm"
        loading={loading}
        disabled={!only}
        title={targets.reason ?? undefined}
        onClick={() => {
          if (only) onCall(only.seat.id);
        }}
      >
        {only && !single ? `Call to ${only.seat.name}` : "Call now"}
      </Button>
    );
  }

  return (
    <span ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        disabled={loading}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={cn(controlClasses("ghost", "sm"), "disabled:opacity-50", open && "border-strong bg-shell-mid")}
      >
        Call now
        <Icon icon={ChevronDown} size={14} className="text-muted" />
      </button>
      <span
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-20 mt-1 block w-[184px] rounded-[10px] border border-shell-line bg-shell-soft p-1 shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_12px_32px_rgb(0_0_0_/_0.10)]"
      >
        {targets.chairs.map((chair) => (
          <button
            key={chair.seat.id}
            type="button"
            className="flex w-full items-center rounded-[7px] px-2.5 py-2 text-left text-[13.5px] text-strong transition-colors hover:bg-shell-mid pointer-coarse:min-h-11"
            onClick={() => {
              setOpen(false);
              onCall(chair.seat.id);
            }}
          >
            Call to {chair.seat.name}
          </button>
        ))}
      </span>
    </span>
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
  targets,
  single,
}: {
  skipped: QueueEntry[];
  pendingEntryId: string | null;
  targets: CallTargets;
  single: boolean;
  onRecall: (entryId: string, seatId: string) => void;
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
            <CallButton
              targets={targets}
              single={single}
              loading={pendingEntryId === entry.id}
              onCall={(seatId) => onRecall(entry.id, seatId)}
            />
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
  targets,
  single,
  onCall,
  onAttend,
  onSkip,
}: {
  entry: WaitingRow;
  disabled: boolean;
  targets: CallTargets;
  single: boolean;
  onCall: (seatId: string) => void;
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
        className="absolute right-0 top-full z-20 mt-1 block w-[200px] rounded-[10px] border border-shell-line bg-shell-soft p-1 shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_12px_32px_rgb(0_0_0_/_0.10)]"
      >
        {targets.chairs.length === 0 ? (
          <button
            type="button"
            className={cn(item, "disabled:cursor-not-allowed disabled:opacity-50")}
            disabled
            title={targets.reason ?? undefined}
          >
            Call now
          </button>
        ) : (
          targets.chairs.map((chair) => (
            <button
              key={chair.seat.id}
              type="button"
              className={item}
              onClick={() => { setOpen(false); onCall(chair.seat.id); }}
            >
              {single ? "Call now" : `Call to ${chair.seat.name}`}
            </button>
          ))
        )}
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
