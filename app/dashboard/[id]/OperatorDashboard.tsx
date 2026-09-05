"use client";

import { useState, type JSX } from "react";
import { toast } from "sonner";
import { AccessNotice } from "@/components/AccessNotice";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import { QueueArranging } from "@/components/QueueArranging";
import { Counter, Finder, type Confirmation } from "./Counter";
import { DashboardChrome } from "./DashboardChrome";
import { useOperatorQueue } from "@/hooks/useOperatorQueue";
import { useWakeLock } from "@/hooks/useWakeLock";
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

  // A counter tablet that dims to black is a blank counter.
  useWakeLock();

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

  return (
    <DashboardChrome
      queueId={queueId}
      tab="counter"
      queueName={view.queue.name}
      queueSlug={view.queue.slug}
      status={view.queue.status}
      connection={queue.connection}
      toolbar={<Finder query={query} onQuery={setQuery} className="w-[320px]" />}
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

      <Counter
        view={view}
        isOwner={queue.isOwner}
        serving={queue.serving}
        pendingEntryId={queue.pendingEntryId}
        pendingAction={queue.pendingAction}
        query={query}
        onQuery={setQuery}
        onServeNext={queue.serveNextCustomer}
        onEntry={(entryId, action) => void queue.actOnCustomer(entryId, action)}
        onQueue={(action) => void queue.actOnThisQueue(action)}
        onConfirm={setConfirming}
        onAddWalkIn={queue.addWalkIn}
        addingWalkIn={queue.addingWalkIn}
      />

      <Confirmations
        confirming={confirming}
        onClose={() => setConfirming(null)}
        pendingAction={queue.pendingAction}
        pendingEntryId={queue.pendingEntryId}
        onSkip={(entryId) => void queue.actOnCustomer(entryId, "skip")}
        onAct={(action) => void queue.actOnThisQueue(action)}
      />
    </DashboardChrome>
  );
}

function Confirmations({
  confirming,
  onClose,
  pendingAction,
  pendingEntryId,
  onSkip,
  onAct,
}: {
  confirming: Confirmation;
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
        description={`${entry.customerName || `Customer ${entry.number}`} keeps their number for 30 minutes and you can call them back from the list. Use this when someone isn't there.`}
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
