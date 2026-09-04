"use client";

import { useState, type JSX, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LiveIndicator, type ConnectionState } from "@/components/LiveIndicator";
import { MonoLabel } from "@/components/Label";
import { Notice } from "@/components/Notice";
import { Numeral } from "@/components/Numeral";
import { Perforation, TicketCard } from "@/components/TicketCard";
import { QueueArranging } from "@/components/QueueArranging";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
import { useCustomerQueue } from "@/hooks/useCustomerQueue";
import type { CustomerView, QueueEntry } from "@/lib/types";
import { JoinQueueForm } from "./JoinQueueForm";
import { TicketPass } from "./TicketPass";

export function CustomerQueue({ slug }: { slug: string }): JSX.Element {
  const queue = useCustomerQueue(slug);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  if (queue.loading) return <LoadingShell />;

  if (queue.loadError || !queue.view) {
    return (
      <PlainShell connection={queue.connection}>
        <Notice tone="standing" title={titleForError(queue.loadError?.code)}>
          {queue.loadError?.message ?? "We couldn't load this queue."}
        </Notice>
      </PlainShell>
    );
  }

  const { view } = queue;
  const activeEntry = view.entry && isActive(view.entry) ? view.entry : null;

  async function onConfirmLeave(): Promise<void> {
    const left = await queue.leave();
    setConfirmingLeave(false);
    if (left) toast.success("Your place has been cancelled");
  }

  return (
    <>
      {activeEntry ? (
        <TicketPass
          view={view}
          entry={activeEntry}
          connection={queue.connection}
          onCancel={() => setConfirmingLeave(true)}
        />
      ) : (
        <JoinScreen
          view={view}
          joining={queue.joining}
          onJoin={queue.join}
          connection={queue.connection}
        />
      )}

      <ConfirmDialog
        open={confirmingLeave}
        onOpenChange={setConfirmingLeave}
        title="Cancel your place?"
        description="You'll lose your number. If you come back you'll join at the end of the queue."
        confirmLabel="Cancel my place"
        cancelLabel="Keep my place"
        destructive
        loading={queue.leaving}
        onConfirm={onConfirmLeave}
      />
    </>
  );
}

/**
 * Not in the handoff — extended from the ticket language. The unclaimed ticket
 * shows the queue's own numbers so the customer can judge the wait before
 * giving a name.
 */
function JoinScreen({
  view,
  joining,
  onJoin,
  connection,
}: {
  view: CustomerView;
  joining: boolean;
  onJoin: (name: string) => Promise<boolean>;
  connection: ConnectionState;
}): JSX.Element {
  const { queue: summary, servingNumber, waitingCount, isFull } = view.state;
  const canJoin = summary.status === "OPEN" && !isFull;

  return (
    <PlainShell connection={connection}>
      <TicketCard className="p-[22px]">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[22px] font-medium leading-tight tracking-[-0.02em] text-paper-ink">{summary.name}</h1>
        </div>
        {summary.description && (
          <p className="mt-2 text-[13px] leading-[1.55] text-paper-muted">{summary.description}</p>
        )}

        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <MonoLabel size={10} tone="paper">
              Now serving
            </MonoLabel>
            <Numeral value={servingNumber} scale="medium" className="mt-1.5 text-paper-ink" />
          </div>
          <div className="text-right">
            <MonoLabel size={10} tone="paper">
              Waiting
            </MonoLabel>
            <Numeral value={waitingCount} scale="medium" className="mt-1.5 text-paper-ink" />
          </div>
        </div>

        <Perforation className="-mx-[22px] my-5" />

        <MonoLabel size={10} tone="paper">
          Est. wait if you join now
        </MonoLabel>
        <p className="numeral mt-1.5 text-[clamp(28px,8vw,36px)] text-paper-ink">
          {view.joinEstimate?.label ?? "No wait"}
        </p>
      </TicketCard>

      {view.entry && <PreviousEntryNotice entry={view.entry} />}

      {summary.status === "PAUSED" && (
        <Notice tone="standing" title="Queue paused">
          This queue isn&rsquo;t taking new numbers right now. Check back shortly.
        </Notice>
      )}

      {summary.status === "CLOSED" && (
        <Notice tone="standing" title="Queue closed">
          This queue isn&rsquo;t accepting new customers.
        </Notice>
      )}

      {summary.status === "OPEN" && isFull && (
        <Notice tone="standing" title="Queue full">
          {summary.maxCapacity} is the limit for now. Try again once someone has been served.
        </Notice>
      )}

      {canJoin && (
        <>
          <JoinQueueForm onJoin={onJoin} joining={joining} />
          <MonoLabel size={10} tone="muted" className="text-center">
            No app · No account · Your place is held
          </MonoLabel>
        </>
      )}
    </PlainShell>
  );
}

function PreviousEntryNotice({ entry }: { entry: QueueEntry }): JSX.Element | null {
  switch (entry.status) {
    case "SKIPPED":
      return (
        <Notice tone="standing" title="You were skipped" chip="!">
          Number {entry.number} was passed over. Take a new number below.
        </Notice>
      );
    case "ATTENDED":
      return (
        <Notice tone="quiet" title="You've been served" chip="✓">
          Thanks for waiting. Take another number if you need anything else.
        </Notice>
      );
    case "LEFT":
      return (
        <Notice tone="quiet" title="You cancelled your place">
          Number {entry.number} is no longer held. Take a new number below.
        </Notice>
      );
    case "CLEARED":
      return (
        <Notice tone="quiet" title="This queue was reset">
          Your previous number is no longer active.
        </Notice>
      );
    default:
      return null;
  }
}

function PlainShell({
  children,
  connection,
}: {
  children: ReactNode;
  connection: ConnectionState;
}): JSX.Element {
  return (
    <div className="min-h-dvh bg-shell transition-colors duration-500 motion-reduce:transition-none">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 py-5 lg:justify-center">
        <header className="flex items-center justify-between">
          {/* The only way off this page. A customer arrives here by scanning a
              code, so there is no history to go back through — and the ticket
              itself is recovered from storage on return, so leaving costs
              nothing. */}
          <Wordmark size={20} />
          <div className="flex items-center gap-3">
            <ThemeToggle variant="quiet" />
            <LiveIndicator state={connection} />
          </div>
        </header>
        <main className="flex flex-col gap-4">{children}</main>
      </div>
    </div>
  );
}

function LoadingShell(): JSX.Element {
  return (
    <div className="min-h-dvh bg-shell" aria-busy="true">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 py-5 lg:justify-center">
        <header className="flex items-center justify-between">
          <Wordmark size={20} />
          <LiveIndicator state="reconnecting" />
        </header>
        <QueueArranging label="Loading the queue" />
      </div>
    </div>
  );
}

function isActive(entry: QueueEntry): boolean {
  return entry.status === "WAITING" || entry.status === "SERVING";
}

function titleForError(code: string | undefined): string {
  switch (code) {
    case "queue_not_found":
      return "Queue not found";
    case "network_error":
      return "Connection lost";
    default:
      return "Something went wrong";
  }
}

