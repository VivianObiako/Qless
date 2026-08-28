"use client";

import { useId, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { AccessNotice } from "@/components/AccessNotice";
import { Button, controlClasses } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MonoLabel } from "@/components/Label";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import { Numeral } from "@/components/Numeral";
import { QrCode, downloadQrPng } from "@/components/QrCode";
import { QueueArranging } from "@/components/QueueArranging";
import { DashboardChrome } from "./DashboardChrome";
import { useOperatorQueue } from "@/hooks/useOperatorQueue";
import { useOrigin } from "@/hooks/useStoredValue";
import { cn } from "@/lib/utils";
import type { OperatorView, Queue, QueueAction, WaitingRow } from "@/lib/types";

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
      status={view.queue.status}
      customerHref={`/q/${view.queue.slug}`}
      connection={queue.connection}
    >
      {queue.actionError && (
        <Notice tone="standing" title="That didn't go through" chip="!" className="mb-4">
          {queue.actionError.message}
        </Notice>
      )}

      {/* Said once, quietly. Without it a counter of blank rows reads as a bug
          rather than as the setting the owner chose. */}
      {!view.showsNames && (
        <Notice tone="quiet" className="mb-4">
          This queue keeps customer names to its owner. Call people by their number.
        </Notice>
      )}

      <div className="grid gap-px overflow-hidden rounded-t-[var(--radius-panel)] bg-shell-line lg:grid-cols-[1fr_380px]">
        <AtTheCounter
          view={view}
          serving={queue.serving}
          onServeNext={queue.serveNextCustomer}
          onAttend={(entryId) => void queue.actOnCustomer(entryId, "attend")}
          pendingEntryId={queue.pendingEntryId}
        />
        <WaitingList
          waiting={view.waiting}
          pendingEntryId={queue.pendingEntryId}
          onServe={(entryId) => void queue.actOnCustomer(entryId, "serve")}
          onSkip={(entry) => setConfirming({ kind: "skip", entry })}
        />
      </div>

      <dl className="mt-px grid grid-cols-2 gap-px overflow-hidden rounded-b-[var(--radius-panel)] bg-shell-line sm:grid-cols-3">
        <Stat label="Waiting" value={String(view.waitingCount)} />
        <Stat label="Avg service" value={`${view.queue.averageServiceMinutes}m`} />
        <Stat
          label="At the counter"
          value={view.serving ? `#${view.serving.number}` : "—"}
          className="col-span-2 sm:col-span-1"
        />
      </dl>

      <QueueControls
        queue={view.queue}
        isOwner={queue.isOwner}
        pendingAction={queue.pendingAction}
        onAct={(action) => void queue.actOnThisQueue(action)}
        onConfirm={setConfirming}
      />

      <ShareQueue queue={view.queue} />

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

/**
 * What the operator is being asked to confirm, if anything. PROMPT.md asks for
 * a dialog on skip, close and reset — and deliberately not on serve next, which
 * is the action they take all day.
 */
type Confirmation =
  | { kind: "skip"; entry: WaitingRow }
  | { kind: "close" }
  | { kind: "reset" }
  | null;

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
        description={`${entry.customerName} keeps their record and can rejoin for a new number. Use this when someone isn't there.`}
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

/**
 * The controls an operator reaches for a few times a day rather than a few
 * times a minute, kept apart from the counter for exactly that reason.
 *
 * Pausing is shared with operators — stepping away from the counter is their
 * decision to make — and stays in the open, because it is the one control here
 * that gets used in an ordinary afternoon. Closing and clearing end the day,
 * belong to the owner, and sit behind a disclosure: a confirm dialog is weak
 * protection against a fat-finger on a counter tablet, since the dialog gets
 * tapped out of habit too.
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

  // Escape is handled where the disclosure is rather than on the document: the
  // panel is inline, so every key worth intercepting is raised inside this
  // section and bubbles to here.
  function onKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== "Escape" || !moreOpen) return;
    setMoreOpen(false);
    toggleRef.current?.focus();
  }

  return (
    <section
      aria-labelledby="controls-heading"
      onKeyDown={onKeyDown}
      className="mt-4 rounded-[var(--radius-panel)] bg-shell-soft p-7"
    >
      <MonoLabel as="h2" size={10} tone="muted" id="controls-heading">
        Queue controls
      </MonoLabel>

      <div className="mt-5 flex flex-wrap items-center gap-2">
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

        {/* A disclosure, not a menu. Menu semantics promise roving tabindex,
            arrow keys and typeahead; what is behind this is two ordinary
            buttons that belong in the tab order.

            ml-auto rather than justify-between on the row: at 320px the two
            controls wrap, and the auto margin keeps this one on the right of
            whichever line it lands on rather than dropping it under Pause. */}
        {isOwner && (
          <button
            type="button"
            ref={toggleRef}
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen((open) => !open)}
            className={cn(controlClasses("ghost", "md"), "ml-auto gap-2.5")}
          >
            More<span className="sr-only"> queue actions</span>
            <Chevron open={moreOpen} />
          </button>
        )}
      </div>

      <p className="mt-4 font-mono text-[11px] leading-[1.7] text-muted">
        {paused
          ? "Paused: nobody new can join. Everyone waiting keeps their place."
          : closed
            ? "Closed: nobody new can join. Everyone waiting keeps their place."
            : "Pausing stops new customers joining without disturbing the queue."}
      </p>

      {/* Inline, so it pushes the page down rather than floating over it: no
          absolute positioning to clip, and nothing to dismiss by clicking away.
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

/**
 * One action behind the disclosure, with the line that says what it does.
 *
 * Monochrome, like everything else here. Escalation in this product is carried
 * by inversion and weight; the vermilion means "your turn" and nothing else.
 */
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
      <Button
        variant="ghost"
        size="md"
        onClick={onClick}
        className="shrink-0 self-start sm:self-auto"
      >
        {label}
      </Button>
      <p className="font-mono text-[11px] leading-[1.7] text-muted">{description}</p>
    </div>
  );
}

/**
 * Drawn rather than imported. The product has no icon language — the theme
 * control draws its own mark from the ticket for the same reason — and one
 * chevron is not a reason to introduce one.
 */
function Chevron({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "h-1.5 w-2.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none",
        open && "rotate-180",
      )}
    >
      <path d="M1 1.25 5 4.75 9 1.25" />
    </svg>
  );
}

/**
 * How customers get in. The operator sets this up once and then mostly ignores
 * it, so it sits under the working part of the screen rather than competing
 * with it — but it stays on the dashboard, because "turn the tablet round so
 * they can scan it" is a real thing that happens at a counter.
 */
const shareQrId = "dashboard-share-qr";

function ShareQueue({ queue }: { queue: Queue }): JSX.Element {
  const origin = useOrigin();

  const customerUrl = `${origin}/q/${queue.slug}`;

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(customerUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  }

  function downloadQr(): void {
    if (downloadQrPng(shareQrId, `qless-${queue.slug}.png`)) {
      toast.success("QR code saved");
    } else {
      toast.error("Couldn't save the QR code. Try the print sheet instead.");
    }
  }

  return (
    <section
      aria-labelledby="share-heading"
      className="mt-4 flex flex-col gap-6 rounded-[var(--radius-panel)] bg-shell-soft p-7 sm:flex-row sm:items-center sm:gap-8"
    >
      {origin && (
        <QrCode
          id={shareQrId}
          value={customerUrl}
          label={`QR code to join the queue at ${queue.name}`}
          className="w-[132px] shrink-0"
        />
      )}

      <div className="min-w-0">
        <MonoLabel as="h2" size={10} tone="muted" id="share-heading">
          Scan to join
        </MonoLabel>
        <p className="mt-2 break-all font-mono text-[12px] leading-relaxed text-strong">
          {customerUrl || `/q/${queue.slug}`}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="ghost" size="md" onClick={copyLink}>
            Copy link
          </Button>
          <Button variant="ghost" size="md" onClick={downloadQr} disabled={!origin}>
            Download QR
          </Button>
          <LinkButton href={`/print/${queue.slug}`} variant="ghost" size="md">
            Print sheet
          </LinkButton>
          {/* The screen on the wall. A new tab because it is a second display,
              not somewhere the counter navigates away to. */}
          <a
            href={`/display/${queue.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-faint px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:border-strong hover:text-strong"
          >
            Display board
          </a>
        </div>
      </div>
    </section>
  );
}

function AtTheCounter({
  view,
  serving,
  onServeNext,
  onAttend,
  pendingEntryId,
}: {
  view: OperatorView;
  serving: boolean;
  onServeNext: () => Promise<void>;
  onAttend: (entryId: string) => void;
  pendingEntryId: string | null;
}): JSX.Element {
  const next = view.waiting[0];
  const current = view.serving;

  // The same request does both halves: it attends whoever is at the counter and
  // promotes the next number. With nobody waiting only the first half happens,
  // so the button stays live and says what it will actually do — otherwise the
  // last customer of the day could never be closed out from here.
  const label = next
    ? `Serve next · ${next.number}`
    : current
      ? `Finish with ${current.customerName || `#${current.number}`}`
      : "Serve next";

  // min-w-0: a grid item sizes to its content by default, and a customer name
  // can run to 60 characters — without it the column widens and the panel clips
  // the name and the button rather than fitting them.
  return (
    <section aria-labelledby="counter-heading" className="min-w-0 bg-shell-soft p-7 sm:p-9">
      <MonoLabel as="h2" size={10} tone="muted" id="counter-heading">
        At the counter
      </MonoLabel>

      {/* Height reserved in both states so promoting a customer never shifts
          the Serve Next button under the operator's cursor. */}
      <div role="status" aria-live="polite" className="mt-4 flex min-h-[130px] flex-col justify-end">
        {current ? (
          <>
            <Numeral value={current.number} scale="next" className="text-strong" />
            {/* Blank when this queue keeps names to the owner. The number is
                already the whole of what staff are given, so the line is
                dropped rather than filled with a placeholder. */}
            {current.customerName && (
              <p className="mt-3 font-serif text-[28px] leading-none text-strong">
                {current.customerName}
              </p>
            )}
          </>
        ) : (
          <p className="font-serif text-[28px] leading-none text-muted">
            {next ? "Ready when you are." : "Nobody in the queue."}
          </p>
        )}
      </div>

      <Button
        variant="contrast"
        fullWidth
        loading={serving}
        disabled={!next && !current}
        onClick={() => void onServeNext()}
        className="mt-7"
      >
        <span className="truncate">{label}</span>
      </Button>

      {/* Finishing with someone without calling the next customer. Serve Next
          does both in one press and is the button for the busy case; this is
          for the end of a run, when nobody should be called up next. */}
      {current && next && (
        <Button
          variant="ghost"
          size="md"
          loading={pendingEntryId === current.id}
          onClick={() => onAttend(current.id)}
          className="mt-2 w-full"
        >
          <span className="truncate">Finish without calling anyone</span>
        </Button>
      )}

      {!next && current && (
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
          Nobody else is waiting.
        </p>
      )}
    </section>
  );
}

function WaitingList({
  waiting,
  pendingEntryId,
  onServe,
  onSkip,
}: {
  waiting: WaitingRow[];
  pendingEntryId: string | null;
  onServe: (entryId: string) => void;
  onSkip: (entry: WaitingRow) => void;
}): JSX.Element {
  return (
    <section aria-labelledby="waiting-heading" className="bg-shell-soft">
      <div className="flex items-center justify-between px-5 py-4">
        <MonoLabel as="h2" size={10} tone="muted" id="waiting-heading">
          Waiting
        </MonoLabel>
        <MonoLabel size={10} tone="muted">
          Est.
        </MonoLabel>
      </div>

      {waiting.length === 0 ? (
        <p className="px-5 pb-8 font-mono text-[11px] leading-[1.7] text-muted">
          No one is waiting. Share the queue link and customers appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-px bg-shell-line">
          {waiting.map((entry, index) => (
            <li key={entry.id} className="animate-row-in bg-shell-soft px-5 py-3.5">
              <div className="flex items-center gap-4">
                <Numeral
                  value={entry.number}
                  scale="board"
                  animateOnChange={false}
                  className="w-12 shrink-0 text-strong"
                />
                {/* Empty when this queue keeps names to the owner. The span
                    stays so the row keeps its shape: a queue of numbers should
                    read as the same list, not as numerals that have drifted
                    across into the estimates. */}
                <span className="min-w-0 flex-1 truncate font-serif text-[19px] text-strong">
                  {entry.customerName}
                </span>
                <MonoLabel size={10} tone="muted" tracking="tight" className="shrink-0">
                  {index === 0 ? "Next" : (entry.estimate?.label ?? "—")}
                </MonoLabel>
              </div>

              {/* Indented to the number's width so the actions read as
                  belonging to this row rather than to the list. */}
              <div className="mt-2.5 flex gap-2 pl-16">
                <Button
                  variant="ghost"
                  size="sm"
                  loading={pendingEntryId === entry.id}
                  onClick={() => onServe(entry.id)}
                >
                  Serve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingEntryId === entry.id}
                  onClick={() => onSkip(entry)}
                >
                  Skip
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}): JSX.Element {
  return (
    <div className={`bg-shell-soft px-5 py-4 ${className ?? ""}`}>
      <MonoLabel as="dt" size={10} tone="muted">
        {label}
      </MonoLabel>
      <dd className="numeral mt-1 text-[28px] text-strong">{value}</dd>
    </div>
  );
}


