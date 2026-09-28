"use client";

import { useEffect, useState, type JSX } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Numeral } from "@/components/Numeral";
import { useDisclosure } from "@/hooks/useDisclosure";
import { minutesSince, useNow } from "@/hooks/useNow";
import { ApiError, getOperators } from "@/lib/api";
import { isMine, workerName, type Chair } from "@/lib/seats";
import { cn } from "@/lib/utils";
import type { Operator, QueueEntry, UpdateSeatInput, WaitingRow } from "@/lib/types";
import { nameFor, PresenceTag, skipConsequence } from "./Counter";

/** The two minutes a customer can ask for on top of the hold, from the pass. */
const HOLD_REQUEST_MINUTES = 2;

export interface ChairCardProps {
  chair: Chair;
  /** Who the counter calls next, for the button's label: the head of the list, or the drawn number. */
  next: WaitingRow | undefined;
  /** How many are waiting. In a draw nobody may be drawn yet while people wait. */
  waitingCount: number;
  /** The queue calls at random: the button draws rather than serves. */
  draw: boolean;
  /** What one person in this queue is called, for someone with no name shown. */
  person: string;
  /**
   * A one-seat queue. The card is headed "At the counter", the chair's name
   * and worker are never shown, and the staffing rule is off: one chair is
   * the counter, whoever is standing at it.
   */
  single: boolean;
  isOwner: boolean;
  principalId: string | null;
  seatsFixed: boolean;
  holdMinutes: number;
  /** Serve next in flight. */
  serving: boolean;
  pendingEntryId: string | null;
  pendingSeatId: string | null;
  onServeNext: (seatId: string) => void;
  onAttend: (entryId: string) => void;
  onStart: (entryId: string) => void;
  onSkip: (entry: QueueEntry) => void;
  onTake: (seatId: string) => void;
  onLeave: (seatId: string) => void;
  onSetOpen: (seatId: string, active: boolean) => void;
  /** Owner only: who works the chair. Absent hides the chair's menu. */
  onAssign?: (seatId: string, worker: UpdateSeatInput["worker"]) => void;
  /** The session token, for the chair menu to list who could work it. */
  token?: string | null;
  /** Smaller numeral, for four cards in a row. */
  compact?: boolean;
  /** On the All chairs page: tapping the heading opens the chair on the counter. */
  onOpenOnCounter?: () => void;
  className?: string;
}

/**
 * One chair, with the three stages every chair has: call, start or hold,
 * done. It is the counter card of a one-seat queue, the open chair beside
 * the waiting list, and each card on the All chairs page — the same
 * component, so the stages cannot drift apart between screens.
 */
export function ChairCard({
  chair,
  next,
  waitingCount,
  draw,
  person,
  single,
  isOwner,
  principalId,
  seatsFixed,
  holdMinutes,
  serving,
  pendingEntryId,
  pendingSeatId,
  onServeNext,
  onAttend,
  onStart,
  onSkip,
  onTake,
  onLeave,
  onSetOpen,
  onAssign,
  token,
  compact = false,
  onOpenOnCounter,
  className,
}: ChairCardProps): JSX.Element {
  const now = useNow();
  const { seat, entry: current } = chair;
  const hold = holdMinutes;
  const mine = isMine(seat, isOwner, principalId);
  const seatPending = pendingSeatId === seat.id;

  // Two clocks on the card: called-and-not-here, then being served. The
  // second starts when the pass says "here", when the person was already
  // here at the call, or on one tap.
  const started = current?.servedAt ?? null;

  // The hold time doing its first job: once a called person has been silent
  // for longer than the queue holds a place, the counter says so. Service
  // beginning ends it, and a two-minute request from the pass adds two.
  const sinceCalled = current?.startedAt ? minutesSince(current.startedAt, now) : 0;
  const grace = hold + (current?.presence === "HOLD" ? HOLD_REQUEST_MINUTES : 0);
  const overdue =
    hold > 0 && current !== null && started === null && current.presence !== "HERE" && sinceCalled >= grace;

  // One thing at a time. With one seat, an open chair is always ready: the
  // staffing rule exists to keep customers off an empty chair among several.
  const stage =
    current !== null
      ? started === null
        ? "called"
        : "serving"
      : chair.state === "closed"
        ? "closed"
        : chair.state === "unstaffed" && !single
          ? "unstaffed"
          : "ready";

  const heading = single ? "At the counter" : `${seat.name} · ${workerName(seat)}`;
  const headingId = `chair-${seat.id}`;

  return (
    <section aria-labelledby={headingId} className={cn("flex min-w-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-3">
        {onOpenOnCounter ? (
          <button
            type="button"
            id={headingId}
            onClick={onOpenOnCounter}
            className="truncate text-left text-[13px] font-medium text-strong underline-offset-4 hover:underline pointer-coarse:min-h-11"
          >
            {heading}
          </button>
        ) : (
          <h3 id={headingId} className={cn("truncate text-[12.5px]", single ? "text-muted" : "text-dim")}>
            {heading}
          </h3>
        )}
        {!single && isOwner && onAssign && token && (
          <ChairMenu
            chair={chair}
            mine={mine}
            token={token}
            disabled={seatPending}
            onTake={() => onTake(seat.id)}
            onLeave={() => onLeave(seat.id)}
            onAssign={(worker) => onAssign(seat.id, worker)}
            onSetOpen={(active) => onSetOpen(seat.id, active)}
          />
        )}
      </div>

      {/* Height reserved in every state so promoting a customer never shifts
          the Serve next button under the operator's cursor. */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "mt-3 flex flex-col justify-end",
          compact ? "min-h-[120px]" : "min-h-[170px] 2xl:min-h-[220px]",
        )}
      >
        {current ? (
          <>
            {/* The one colour on the screen: this number is being called, the
                same vermilion the customer's phone has turned. */}
            <Numeral
              value={current.number}
              scale={compact ? "hero" : "next"}
              className={cn("text-signal", !compact && "2xl:text-[200px]")}
            />
            <p
              className={cn(
                "mt-4 flex items-center gap-2.5 font-medium leading-tight tracking-[-0.02em] text-strong",
                compact ? "text-[18px]" : "text-[22px]",
              )}
            >
              {nameFor(current, person)}
              <PresenceTag presence={current.presence} />
            </p>
            <p className="mt-1 text-[13px] text-muted" suppressHydrationWarning>
              {started
                ? `Serving for ${minutesSince(started, now)} min`
                : current.startedAt && `Called ${sinceCalled} min ago`}
              {(started || current.startedAt) && " · "}
              waited {minutesSince(current.joinedAt, now)} min
              {started && current.startedAt && ` · arrived in ${minutesSince(current.startedAt, Date.parse(started))} min`}
            </p>
            {overdue ? (
              <p className="mt-2 text-[13px] leading-[1.55] text-strong" suppressHydrationWarning>
                No sign of them for {sinceCalled} min. Skipping frees {single ? "the counter" : seat.name}.{" "}
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
        ) : stage === "closed" ? (
          <>
            <p className="text-[24px] font-medium leading-tight tracking-[-0.02em] text-muted">Closed.</p>
            <p className="mt-2 text-[13px] leading-[1.55] text-muted">Out of the estimate and off the wall.</p>
          </>
        ) : stage === "unstaffed" ? (
          <>
            <p className="text-[24px] font-medium leading-tight tracking-[-0.02em] text-muted">Nobody at it.</p>
            <p className="mt-2 text-[13px] leading-[1.55] text-muted">
              Open, so it counts in the estimate. Nobody can be called here until someone takes it.
            </p>
          </>
        ) : (
          <p className="text-[24px] font-medium leading-tight tracking-[-0.02em] text-muted">
            {waitingCount > 0 ? "Ready when you are." : "Nobody in the queue."}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {stage === "ready" && (
          <>
            <Button
              variant="contrast"
              size="md"
              loading={serving}
              disabled={waitingCount === 0}
              onClick={() => onServeNext(seat.id)}
            >
              <span className="truncate">{serveLabel(draw, next)}</span>
            </Button>
            {!single && isOwner && (
              <Button variant="ghost" size="md" loading={seatPending} onClick={() => onSetOpen(seat.id, false)}>
                Close
              </Button>
            )}
          </>
        )}

        {stage === "unstaffed" && (
          <>
            {(isOwner || !seatsFixed) && (
              <Button variant="contrast" size="md" loading={seatPending} onClick={() => onTake(seat.id)}>
                Take this chair
              </Button>
            )}
            {isOwner && (
              <Button variant="ghost" size="md" disabled={seatPending} onClick={() => onSetOpen(seat.id, false)}>
                Close
              </Button>
            )}
          </>
        )}

        {stage === "closed" && isOwner && (
          <Button variant="ghost" size="md" loading={seatPending} onClick={() => onSetOpen(seat.id, true)}>
            Open chair
          </Button>
        )}

        {/* Called and not here yet. Start serving when they walk up; hold
            them when they do not. Overdue swaps which of the two leads. */}
        {stage === "called" && current && (
          <>
            <Button
              variant={overdue ? "ghost" : "contrast"}
              size="md"
              loading={pendingEntryId === current.id}
              onClick={() => onStart(current.id)}
            >
              Start serving
            </Button>
            <Button
              variant={overdue ? "contrast" : "ghost"}
              size="md"
              disabled={pendingEntryId === current.id}
              onClick={() => onSkip(current)}
            >
              {hold > 0 ? "Skip and hold" : "Skip"}
            </Button>
          </>
        )}

        {/* Being served. Done is the only real action; the hold is kept as
            a quiet way back from a mistaken start. */}
        {stage === "serving" && current && (
          <>
            <Button
              variant="contrast"
              size="md"
              loading={pendingEntryId === current.id}
              onClick={() => onAttend(current.id)}
            >
              Done with {nameFor(current, person)}
            </Button>
            <button
              type="button"
              disabled={pendingEntryId === current.id}
              onClick={() => onSkip(current)}
              className="px-2 py-1 text-[13px] text-muted underline-offset-4 hover:text-strong hover:underline pointer-coarse:py-3"
            >
              {hold > 0 ? "Skip and hold instead" : "Skip instead"}
            </button>
          </>
        )}
      </div>

      {waitingCount === 0 && current && stage !== "closed" && (
        <p className="mt-3 text-[13px] text-muted">Nobody else is waiting.</p>
      )}
    </section>
  );
}

/**
 * In order, the button names who it will call. In a draw it names the drawn
 * number once there is one, and before the first call it says what it does.
 */
function serveLabel(draw: boolean, next: WaitingRow | undefined): string {
  if (draw) return next ? `Call next · ${next.number}` : "Draw next";
  return next ? `Serve next · ${next.number}` : "Serve next";
}

/**
 * The owner's menu on a chair: take it, give it to somebody on the roster,
 * make it nobody's, or close it. The roster is fetched when the menu opens,
 * so a counter that never touches it never asks.
 */
function ChairMenu({
  chair,
  mine,
  token,
  disabled,
  onTake,
  onLeave,
  onAssign,
  onSetOpen,
}: {
  chair: Chair;
  mine: boolean;
  token: string;
  disabled: boolean;
  onTake: () => void;
  onLeave: () => void;
  onAssign: (worker: UpdateSeatInput["worker"]) => void;
  onSetOpen: (active: boolean) => void;
}): JSX.Element {
  const { open, setOpen, toggle, containerRef, triggerRef, panelId } = useDisclosure();
  const [operators, setOperators] = useState<Operator[] | null>(null);
  const { seat } = chair;

  useEffect(() => {
    if (!open || operators !== null) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const roster = await getOperators(token, controller.signal);
        setOperators(
          roster.operators.filter(
            (operator) => operator.status === "ACTIVE" && operator.queueIds.includes(seat.queueId),
          ),
        );
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (caught instanceof ApiError) setOperators([]);
      }
    })();
    return () => controller.abort();
  }, [open, operators, token, seat.queueId]);

  const item =
    "flex w-full items-center rounded-[7px] px-2.5 py-2 text-left text-[13.5px] text-strong transition-colors hover:bg-shell-mid disabled:cursor-not-allowed disabled:opacity-50";

  function pick(action: () => void): void {
    setOpen(false);
    action();
  }

  const occupied = chair.entry !== null;
  const heldByOperator = seat.worker?.type === "OPERATOR" ? seat.worker.operatorId : null;

  return (
    <span ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`More for ${seat.name}`}
        onClick={toggle}
        className={cn(
          "grid size-8 place-items-center rounded-full border border-transparent text-muted transition-colors",
          "hover:border-shell-line hover:text-strong disabled:opacity-50 pointer-coarse:size-11",
          open && "border-shell-line bg-shell-mid text-strong",
        )}
      >
        <Icon icon={MoreHorizontal} size={16} />
      </button>
      <span
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-20 mt-1 block w-[220px] rounded-[10px] border border-shell-line bg-shell-soft p-1 shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_12px_32px_rgb(0_0_0_/_0.10)]"
      >
        {mine ? (
          <button type="button" className={item} onClick={() => pick(onLeave)}>
            Leave this chair
          </button>
        ) : (
          <button type="button" className={item} disabled={!seat.active} onClick={() => pick(onTake)}>
            Take this chair
          </button>
        )}

        {operators === null ? (
          <span className="block px-2.5 py-2 text-[12.5px] text-muted">Loading your team…</span>
        ) : operators.length > 0 ? (
          <>
            <span className="block px-2.5 pb-1 pt-2 text-[11.5px] text-muted">Give it to</span>
            {operators.map((operator) => (
              <button
                key={operator.id}
                type="button"
                className={item}
                disabled={operator.id === heldByOperator || !seat.active}
                onClick={() => pick(() => onAssign({ type: "OPERATOR", operatorId: operator.id }))}
              >
                {operator.displayName}
                {operator.id === heldByOperator && <span className="ml-auto text-[12px] text-muted">Here now</span>}
              </button>
            ))}
          </>
        ) : null}

        {seat.worker && (
          <button type="button" className={cn(item, "text-dim")} onClick={() => pick(() => onAssign(null))}>
            Nobody at it
          </button>
        )}

        <span className="my-1 block h-px bg-shell-line" />
        <button
          type="button"
          className={cn(item, "text-dim")}
          disabled={seat.active && occupied}
          title={seat.active && occupied ? "Finish with them first" : undefined}
          onClick={() => pick(() => onSetOpen(!seat.active))}
        >
          {seat.active ? "Close chair" : "Open chair"}
        </button>
      </span>
    </span>
  );
}
