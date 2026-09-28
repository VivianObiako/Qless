"use client";

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AccessNotice } from "@/components/AccessNotice";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import { QueueArranging } from "@/components/QueueArranging";
import { ChairCard } from "../ChairCard";
import { skipConsequence } from "../Counter";
import { DashboardChrome } from "../DashboardChrome";
import { useOperatorQueue } from "@/hooks/useOperatorQueue";
import { useWakeLock } from "@/hooks/useWakeLock";
import { chairsOf, openSeatKey } from "@/lib/seats";
import { writeSession } from "@/lib/session";
import type { QueueEntry } from "@/lib/types";

/**
 * Every chair as a full card, four to a row, for an owner running the whole
 * floor. The same cards and the same three stages as the counter; tapping
 * a card's heading opens that chair on the counter with the waiting list
 * beside it.
 */
export function AllChairs({ queueId }: { queueId: string }): JSX.Element {
  const router = useRouter();
  const queue = useOperatorQueue(queueId, null);
  const [skipping, setSkipping] = useState<QueueEntry | null>(null);

  useWakeLock();

  if (queue.loading) {
    return (
      <DashboardChrome queueId={queueId} tab="counter" heading="All chairs">
        <QueueArranging className="mx-auto max-w-md" label="Loading the chairs" />
      </DashboardChrome>
    );
  }

  if (queue.access !== null) {
    return (
      <DashboardChrome queueId={queueId} tab="counter" heading="All chairs">
        <AccessNotice outcome={queue.access} role={queue.endedAs} what="queue" />
      </DashboardChrome>
    );
  }

  if (!queue.hasToken || queue.loadError?.code === "unauthorized" || !queue.isOwner) {
    return (
      <DashboardChrome queueId={queueId} tab="counter" heading="All chairs">
        <Notice
          tone="standing"
          title="This page is the owner's"
          chip="!"
          action={<LinkButton href={`/dashboard/${queueId}`}>Back to the counter</LinkButton>}
        >
          Staff see their own chair on the counter, with the other chairs in the rail for awareness.
        </Notice>
      </DashboardChrome>
    );
  }

  if (queue.loadError || !queue.view) {
    return (
      <DashboardChrome queueId={queueId} tab="counter" heading="All chairs">
        <Notice tone="standing" title="Couldn't load this queue" chip="!">
          {queue.loadError?.message ?? "Try again in a moment."}
        </Notice>
      </DashboardChrome>
    );
  }

  const { view } = queue;
  const chairs = chairsOf(view);
  const open = chairs.filter((chair) => chair.seat.active).length;
  const serving = chairs.filter((chair) => chair.state === "serving").length;
  const called = chairs.filter((chair) => chair.state === "called").length;

  function openOnCounter(seatId: string): void {
    writeSession(openSeatKey(queueId), seatId);
    router.push(`/dashboard/${queueId}`);
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

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h2 className="text-[clamp(30px,6vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
            All chairs
          </h2>
          <p className="mt-2 text-[13px] text-muted">
            {open} of {chairs.length} open · {serving} serving · {called} called · {view.waitingCount} waiting
          </p>
        </div>
        <LinkButton href={`/dashboard/${queueId}`} variant="ghost" size="md">
          <Icon icon={ArrowLeft} size={15} />
          Back to counter
        </LinkButton>
      </div>

      <div className="@container mt-8">
        <ul className="grid gap-x-8 gap-y-10 @xl:grid-cols-2 @5xl:grid-cols-4">
          {chairs.map((chair) => (
            <li key={chair.seat.id} className="min-w-0 border-t border-shell-line pt-4">
              <ChairCard
                chair={chair}
                next={view.waiting[0]}
                single={false}
                isOwner
                principalId={queue.principalId}
                seatsFixed={view.queue.seatsFixed}
                holdMinutes={view.queue.holdMinutes}
                serving={queue.serving}
                pendingEntryId={queue.pendingEntryId}
                pendingSeatId={queue.pendingSeatId}
                onServeNext={(seatId) => void queue.serveNextCustomer(seatId)}
                onAttend={(entryId) => void queue.actOnCustomer(entryId, "attend")}
                onStart={(entryId) => void queue.actOnCustomer(entryId, "start")}
                onSkip={setSkipping}
                onTake={(seatId) => void queue.takeChair(seatId)}
                onLeave={(seatId) => void queue.leaveChair(seatId)}
                onSetOpen={(seatId, active) => void queue.setChairOpen(seatId, active)}
                onAssign={(seatId, worker) => void queue.assignChair(seatId, worker)}
                token={queue.token}
                compact
                onOpenOnCounter={() => openOnCounter(chair.seat.id)}
              />
            </li>
          ))}
        </ul>
        <p className="mt-8 text-[13px] text-muted">
          Tap a chair&rsquo;s name to open it on the counter with the waiting list beside it.
        </p>
      </div>

      <ConfirmDialog
        open={skipping !== null}
        onOpenChange={(next) => {
          if (!next) setSkipping(null);
        }}
        title={skipping ? `Skip #${skipping.number}?` : ""}
        description={
          skipping
            ? `Use this when ${skipping.customerName || `Customer ${skipping.number}`} isn't there. ${skipConsequence(view.queue.holdMinutes)}`
            : ""
        }
        confirmLabel="Skip them"
        cancelLabel="Keep waiting"
        destructive
        loading={skipping !== null && queue.pendingEntryId === skipping.id}
        onConfirm={() => {
          const entry = skipping;
          setSkipping(null);
          if (entry) void queue.actOnCustomer(entry.id, "skip");
        }}
      />
    </DashboardChrome>
  );
}
