"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { toast } from "sonner";
import { AccessNotice } from "@/components/AccessNotice";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import { QueueArranging } from "@/components/QueueArranging";
import { Counter, skipConsequence, type Confirmation } from "./Counter";
import { NewDayNotice } from "./NewDayNotice";
import { DashboardChrome } from "./DashboardChrome";
import { useOperatorQueue } from "@/hooks/useOperatorQueue";
import { useStoredValue } from "@/hooks/useStoredValue";
import { useWakeLock } from "@/hooks/useWakeLock";
import { chairsOf, myChair, openSeatKey, type Chair } from "@/lib/seats";
import { writeSession } from "@/lib/session";
import type { QueueAction } from "@/lib/types";

interface OperatorDashboardProps {
  queueId: string;
  ownerTokenFromUrl: string | null;
}

/**
 * The operator's tool, translated from direction 3a into the final palette.
 *
 * It follows the theme like every other screen. Light mode is the warm paper
 * surface — a working screen under shop lighting; dark mode is the shell the
 * rest of the product runs on. What keeps an operator from mistaking this for a
 * customer's ticket is the layout, not a palette they cannot turn off.
 */
export function OperatorDashboard({
  queueId,
  ownerTokenFromUrl,
}: OperatorDashboardProps): JSX.Element {
  const queue = useOperatorQueue(queueId, ownerTokenFromUrl);
  const [confirming, setConfirming] = useState<Confirmation>(null);
  const [query, setQuery] = useState("");

  // Which chair this device has open, per queue. Staff have no choice — the
  // open chair is theirs — so it is read for the owner only.
  const rememberedSeatId = useStoredValue(openSeatKey(queueId));

  // A counter tablet that dims to black is a blank counter.
  useWakeLock();

  const chairs = queue.view ? chairsOf(queue.view) : [];
  const mine = myChair(chairs, queue.isOwner, queue.principalId);
  useMovedOffNotice(mine, queue.isOwner, queue.principalId);

  if (queue.loading) {
    return (
      <DashboardChrome queueId={queueId} tab="counter">
        <QueueArranging className="mx-auto max-w-md" label="Loading the dashboard" />
      </DashboardChrome>
    );
  }

  // Traced 401s come first: a browser whose session has just been cleared would
  // otherwise fall through to "sign in", which is true but says nothing about
  // what happened or who to ask.
  if (queue.access !== null) {
    return (
      <DashboardChrome queueId={queueId} tab="counter">
        <AccessNotice outcome={queue.access} role={queue.endedAs} what="queue" />
      </DashboardChrome>
    );
  }

  if (!queue.hasToken || queue.loadError?.code === "unauthorized") {
    return (
      <DashboardChrome queueId={queueId} tab="counter">
        <Notice
          tone="standing"
          title="Sign in to run this queue"
          chip="!"
          action={
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/enter">Enter a code</LinkButton>
              <LinkButton href="/create" variant="ghost">
                Create a queue
              </LinkButton>
            </div>
          }
        >
          A queue&rsquo;s address says which queue it is, not who you are. Enter your recovery code
          — or the access code your manager gave you — to run this one from this device.
        </Notice>
      </DashboardChrome>
    );
  }

  if (queue.loadError || !queue.view) {
    return (
      <DashboardChrome queueId={queueId} tab="counter">
        <Notice tone="standing" title="Couldn't load this queue" chip="!">
          {queue.loadError?.message ?? "Try again in a moment."}
        </Notice>
      </DashboardChrome>
    );
  }

  const { view } = queue;

  // The open chair. Staff: theirs, or the first as a place to read from.
  // The owner: what this device remembers, the chair they are on, or the
  // first — a tile that has since been removed falls through to the next.
  const openChair: Chair | null = queue.isOwner
    ? (chairs.find((chair) => chair.seat.id === rememberedSeatId) ?? mine ?? chairs[0] ?? null)
    : (mine ?? chairs[0] ?? null);

  function openChairOnCounter(seatId: string): void {
    writeSession(openSeatKey(queueId), seatId);
  }

  return (
    <DashboardChrome
      queueId={queueId}
      tab="counter"
      queueName={view.queue.name}
      queueSlug={view.queue.slug}
      status={view.queue.status}
      connection={queue.connection}
    >
      {queue.actionError && (
        <Notice tone="standing" title="That didn't go through" chip="!" className="mb-6">
          {queue.actionError.message}
        </Notice>
      )}

      {/* Said once, quietly. Without it a counter of numbers-as-names reads
          as a bug rather than as the setting the owner chose. */}
      {!view.showsNames && (
        <Notice tone="quiet" className="mb-6">
          This queue keeps customer names to its owner. Call people by their number.
        </Notice>
      )}

      {queue.isOwner && (
        <NewDayNotice
          queueId={queueId}
          view={view}
          onStart={() => setConfirming({ kind: "reset" })}
        />
      )}

      <Counter
        view={view}
        isOwner={queue.isOwner}
        principalId={queue.principalId}
        serving={queue.serving}
        pendingEntryId={queue.pendingEntryId}
        pendingAction={queue.pendingAction}
        pendingSeatId={queue.pendingSeatId}
        query={query}
        onQuery={setQuery}
        chairs={chairs}
        openChair={openChair}
        canOpenChair={(chair) => queue.isOwner || chair.seat.id === mine?.seat.id}
        onOpenChair={openChairOnCounter}
        allChairsHref={queue.isOwner && chairs.length > 1 ? `/dashboard/${queueId}/chairs` : undefined}
        onServeNext={queue.serveNextCustomer}
        onEntry={(entryId, action, seatId) => void queue.actOnCustomer(entryId, action, seatId)}
        onQueue={(action, note) => void queue.actOnThisQueue(action, note)}
        onConfirm={setConfirming}
        onAddWalkIn={queue.addWalkIn}
        addingWalkIn={queue.addingWalkIn}
        onTake={(seatId) => void queue.takeChair(seatId)}
        onLeave={(seatId) => void queue.leaveChair(seatId)}
        onSetOpen={(seatId, active) => void queue.setChairOpen(seatId, active)}
        onAssign={(seatId, worker) => void queue.assignChair(seatId, worker)}
        token={queue.token}
      />

      <Confirmations
        confirming={confirming}
        holdMinutes={view.queue.holdMinutes}
        onClose={() => setConfirming(null)}
        pendingAction={queue.pendingAction}
        pendingEntryId={queue.pendingEntryId}
        onSkip={(entryId) => void queue.actOnCustomer(entryId, "skip")}
        onAct={(action) => void queue.actOnThisQueue(action)}
      />
    </DashboardChrome>
  );
}

/**
 * The picker is a soft lock: whoever picks a chair last has it, and the
 * other device is moved off on its next frame. This is the "and told" half
 * — an operator whose chair changes under them hears about it once.
 */
function useMovedOffNotice(mine: Chair | null, isOwner: boolean, principalId: string | null): void {
  const previous = useRef<string | null | undefined>(undefined);
  const current = mine?.seat.id ?? null;
  const name = mine?.seat.name ?? null;

  useEffect(() => {
    // Nothing to compare until the first frame has said where they are.
    if (isOwner || principalId === null) return;
    if (previous.current === undefined) {
      previous.current = current;
      return;
    }
    if (previous.current !== current) {
      if (current === null) toast("You've been moved off your chair. Pick another, or ask the owner.");
      else if (previous.current !== null) toast(`You've been moved to ${name}.`);
      previous.current = current;
    }
  }, [current, name, isOwner, principalId]);
}

function Confirmations({
  confirming,
  holdMinutes,
  onClose,
  pendingAction,
  pendingEntryId,
  onSkip,
  onAct,
}: {
  confirming: Confirmation;
  holdMinutes: number;
  onClose: () => void;
  pendingAction: QueueAction | null;
  pendingEntryId: string | null;
  onSkip: (entryId: string) => void;
  onAct: (action: QueueAction) => void;
}): JSX.Element {
  const open = confirming !== null;

  function onOpenChange(next: boolean): void {
    if (!next) onClose();
  }

  if (confirming?.kind === "skip") {
    const { entry } = confirming;
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Skip #${entry.number}?`}
        description={`Use this when ${entry.customerName || `Customer ${entry.number}`} isn't there. ${skipConsequence(holdMinutes)}`}
        confirmLabel="Skip them"
        cancelLabel="Keep waiting"
        destructive
        loading={pendingEntryId === entry.id}
        onConfirm={() => {
          onSkip(entry.id);
          onClose();
        }}
      />
    );
  }

  if (confirming?.kind === "close") {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Close this queue?"
        description="Nobody new can join. Everyone already waiting keeps their place and can still see their number, and you can reopen whenever you like."
        confirmLabel="Close queue"
        cancelLabel="Keep it open"
        destructive
        loading={pendingAction === "close"}
        onConfirm={() => {
          onAct("close");
          onClose();
        }}
      />
    );
  }

  if (confirming?.kind === "reset") {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Clear the queue?"
        description="Everyone waiting is cleared and numbering starts again at 1. Today's history is kept, but the people in line right now will not know unless you tell them."
        confirmLabel="Clear and restart"
        cancelLabel="Leave it alone"
        destructive
        loading={pendingAction === "reset"}
        onConfirm={() => {
          onAct("reset");
          onClose();
        }}
      />
    );
  }

  // Rendered closed rather than not at all, so the dialog's exit animation and
  // focus restoration run instead of the whole thing vanishing mid-close.
  return (
    <ConfirmDialog
      open={false}
      onOpenChange={onOpenChange}
      title=""
      description=""
      confirmLabel=""
      onConfirm={onClose}
    />
  );
}
