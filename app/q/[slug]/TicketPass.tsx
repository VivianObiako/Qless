"use client";

import type { JSX, ReactNode } from "react";
import { Board } from "@/components/Board";
import { Button } from "@/components/Button";
import { LiveIndicator, type ConnectionState } from "@/components/LiveIndicator";
import { MonoLabel } from "@/components/Label";
import { Notice } from "@/components/Notice";
import { Numeral } from "@/components/Numeral";
import { Perforation, TicketBadge, TicketCard, TicketProgress } from "@/components/TicketCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTurnNotifications, type AlertPermission } from "@/hooks/useTurnNotifications";
import { deriveBoardRows } from "@/lib/board";
import { proximityOf, type CustomerView, type Proximity, type QueueEntry } from "@/lib/types";

interface TicketPassProps {
  view: CustomerView;
  entry: QueueEntry;
  connection: ConnectionState;
  onCancel: () => void;
}

/**
 * The customer's whole product: where am I, how long, is it fair — in one
 * glance, on one screen.
 *
 * Four states form an escalation ladder carried by inversion rather than
 * colour. Paper on shell, then a full flip, then the whole screen. Only the
 * last state is allowed the signal colour.
 *
 * The handoff is a 390px reference. On desktop the stack becomes a two-column
 * composition — the ticket held at a readable size beside the board, rather
 * than a phone layout stretched across a monitor.
 */
/**
 * What a screen reader is told when the queue moves. One sentence, rebuilt on
 * every change, read politely — the screen itself is doing the shouting.
 */
function announcementFor(proximity: Proximity, entry: QueueEntry, view: CustomerView): string {
  const mine = `Your number is ${entry.number}.`;

  switch (proximity) {
    case "current":
      return `It's your turn. ${mine} Head to the counter.`;
    case "next":
      return `You're next. ${mine}`;
    case "close":
      return `You're getting close. ${mine} ${
        view.peopleAhead === 1 ? "One person" : `${view.peopleAhead} people`
      } ahead of you.`;
    default:
      return `You're in the queue. ${mine} ${view.peopleAhead} ahead of you${
        view.estimate ? `, about ${view.estimate.label}` : ""
      }.`;
  }
}

export function TicketPass({ view, entry, connection, onCancel }: TicketPassProps): JSX.Element {
  const proximity = proximityOf(entry, view.peopleAhead);
  const announcement = announcementFor(proximity, entry, view);

  // Mounted here rather than on the waiting screen: the ladder has to survive
  // the customer being escalated from one state to the next, and each of those
  // is a different component.
  const alerts = useTurnNotifications({
    proximity,
    number: entry.number,
    peopleAhead: view.peopleAhead,
    queueName: view.state.queue.name,
  });

  const screen =
    proximity === "current" ? (
      <TurnScreen view={view} entry={entry} onCancel={onCancel} />
    ) : proximity === "next" ? (
      <NextScreen view={view} entry={entry} connection={connection} onCancel={onCancel} />
    ) : (
      <WaitingScreen
        view={view}
        entry={entry}
        connection={connection}
        onCancel={onCancel}
        close={proximity === "close"}
        alerts={alerts}
      />
    );

  return (
    <>
      {/*
        The live region sits outside the screens rather than inside one of them.
        Escalating from "close" to "next" replaces the entire screen, and a
        live region that is inserted along with the change is not reliably
        announced — it has to have been there first. Polite, and it never takes
        focus: the customer may be typing, or reading something else entirely.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {screen}
    </>
  );
}

/**
 * The opt-in, and the one place the product's central promise — "we'll let you
 * know when you're close" — is either kept or honestly withdrawn.
 *
 * Never a nag and never a gate: the button asks once, a browser that has
 * already answered is not asked again, and a browser that cannot do this at all
 * simply says what the page does instead.
 */
function AlertsNotice({
  permission,
  onRequest,
}: {
  permission: AlertPermission;
  onRequest: () => void;
}): JSX.Element {
  if (permission === "default") {
    return (
      <Notice
        tone="standing"
        chip="!"
        action={
          <Button variant="contrast" size="md" onClick={onRequest}>
            Alert me
          </Button>
        }
      >
        We can nudge you at <span className="text-strong">three away</span>, one away, and your
        turn. Your place is held either way.
      </Notice>
    );
  }

  return (
    <Notice tone="quiet" chip="!">
      {permission === "granted" ? (
        <>
          Alerting you at <span className="text-strong">three away</span>, one away, and your turn.
          Your place is held if you close this.
        </>
      ) : permission === "denied" ? (
        <>
          Alerts are blocked for this site, so keep an eye on this page. Your place is held if you
          close it.
        </>
      ) : (
        <>
          Keep this page open and it will keep up. Your place is held if you close it.
        </>
      )}
    </Notice>
  );
}

/** States 01 and 02 — paper ticket on the shell. */
function WaitingScreen({
  view,
  entry,
  connection,
  onCancel,
  close,
  alerts,
}: TicketPassProps & {
  close: boolean;
  alerts: { permission: AlertPermission; request: () => void };
}): JSX.Element {
  const rows = deriveBoardRows({
    servingNumber: view.state.servingNumber,
    waitingNumbers: view.state.waitingNumbers,
    myNumber: entry.number,
  });

  return (
    <Shell connection={connection} showToggle>
      <div className="flex flex-1 flex-col gap-4 lg:grid lg:flex-none lg:grid-cols-[1fr_360px] lg:items-start lg:gap-6">
        <TicketCard className="p-[22px] lg:p-8">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-sans text-[28px] leading-none text-paper-ink lg:text-[34px]">
              {view.state.queue.name}
            </h1>
            <TicketBadge inverted={close}>{close ? "Getting close" : "In queue"}</TicketBadge>
          </div>

          <div className="mt-5 flex items-start justify-between gap-4 lg:mt-8">
            <div className="min-w-0">
              <MonoLabel size={10} tone="paper">
                Your no.
              </MonoLabel>
              <Numeral
                value={entry.number}
                scale="hero"
                className="mt-2 text-paper-ink lg:text-[164px]"
              />
            </div>

            <dl className="shrink-0 space-y-4 text-right lg:space-y-6">
              <div>
                <MonoLabel as="dt" size={10} tone="paper">
                  Now serving
                </MonoLabel>
                <dd>
                  <Numeral
                    value={view.state.servingNumber}
                    scale="small"
                    className="mt-1 text-paper-ink lg:text-[44px]"
                  />
                </dd>
              </div>
              <div>
                <MonoLabel as="dt" size={10} tone="paper">
                  Ahead
                </MonoLabel>
                <dd>
                  <Numeral
                    value={view.peopleAhead}
                    scale="small"
                    className="mt-1 text-paper-ink lg:text-[44px]"
                  />
                </dd>
              </div>
            </dl>
          </div>

          <Perforation className="-mx-[22px] my-5 lg:-mx-8 lg:my-7" />

          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <MonoLabel size={10} tone="paper">
                Est. wait
              </MonoLabel>
              <p className="numeral mt-1.5 text-[clamp(30px,9vw,40px)] text-paper-ink lg:text-[46px]">
                {view.estimate?.label ?? "Almost there"}
              </p>
            </div>

            {close && (
              <MonoLabel size={11} tone="paper" className="shrink-0 text-right">
                Start heading
                <br />
                back
              </MonoLabel>
            )}
          </div>

          {close && (
            <div className="mt-5">
              <TicketProgress filled={Math.max(1, 5 - view.peopleAhead)} />
            </div>
          )}
        </TicketCard>

        <div className="flex flex-1 flex-col gap-4 lg:flex-none">
          <Board rows={rows} />

          {close && (
            <Notice tone="standing" chip="!">
              {view.peopleAhead === 1 ? "One ahead" : `${view.peopleAhead} ahead`} of you. About
              five minutes&rsquo; walk is all you have.
            </Notice>
          )}

          <AlertsNotice permission={alerts.permission} onRequest={alerts.request} />

          <div className="flex-1 lg:hidden" />

          <Button variant="ghost" fullWidth onClick={onCancel}>
            Cancel my place
          </Button>
        </div>
      </div>
    </Shell>
  );
}

/** State 03 — the screen flips against the base theme. */
function NextScreen({ view, entry, connection, onCancel }: TicketPassProps): JSX.Element {
  const rows = deriveBoardRows({
    servingNumber: view.state.servingNumber,
    waitingNumbers: view.state.waitingNumbers,
    myNumber: entry.number,
    collapsed: true,
  });

  return (
    <Shell connection={connection} surface="flip">
      <div className="flex flex-1 flex-col gap-4 lg:grid lg:flex-none lg:grid-cols-[1fr_360px] lg:items-start lg:gap-6">
        <div className="ticket-flip overflow-hidden rounded-[var(--radius-ticket)] p-[22px] lg:p-8">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-sans text-[28px] leading-none lg:text-[34px]">
              {view.state.queue.name}
            </h1>
            <TicketBadge className="border-current bg-transparent">
              You&rsquo;re next
            </TicketBadge>
          </div>

          <div className="mt-5 lg:mt-8">
            <MonoLabel size={10} tone="inherit" className="ticket-flip-muted">
              Your no.
            </MonoLabel>
            <Numeral value={entry.number} scale="next" className="mt-2 lg:text-[196px]" />
          </div>

          <div aria-hidden="true" className="-mx-[22px] my-5 flex h-6 items-center lg:-mx-8 lg:my-7">
            <span className="h-6 w-3 rounded-r-full bg-shell" />
            <span className="ticket-flip-line h-px flex-1 border-t border-dashed" />
            <span className="h-6 w-3 rounded-l-full bg-shell" />
          </div>

          <p className="font-sans text-[34px] leading-tight lg:text-[40px]">
            {view.state.servingNumber === null
              ? "You're up next."
              : `You're up after ${view.state.servingNumber}.`}
          </p>
          <p className="ticket-flip-muted mt-3 font-mono text-[12px] leading-[1.6]">
            Be inside now — if you&rsquo;re not here when you&rsquo;re called, you&rsquo;ll be
            skipped and can rejoin.
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-4 lg:flex-none">
          <Board rows={rows} />

          <div className="flex-1 lg:hidden" />

          <div className="space-y-2">
            <Button variant="contrast" fullWidth>
              I&rsquo;m here
            </Button>
            <Button variant="ghost" fullWidth onClick={onCancel}>
              Cancel my place
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/** State 04 — the only vermilion screen in the product. */
function TurnScreen({ view, entry, onCancel }: Omit<TicketPassProps, "connection">): JSX.Element {
  return (
    <Shell connection="called" surface="signal">
      <div className="flex flex-1 flex-col gap-6 lg:grid lg:flex-none lg:grid-cols-[auto_1fr] lg:items-center lg:gap-16">
        <div>
          {/* The screen's heading, and the only one it has. Set at label size
              because the numeral under it is the thing being announced. */}
          <MonoLabel
            as="h1"
            size={13}
           
            weight={600}
            tone="inherit"
            className="text-white"
          >
            It&rsquo;s your turn
          </MonoLabel>
          <Numeral value={entry.number} scale="turn" className="mt-3 text-white lg:text-[300px]" />
        </div>

        <div className="lg:border-l lg:border-white/35 lg:pl-16">
          <hr className="mb-6 border-0 border-t border-white/35 lg:hidden" />

          <p className="font-sans text-[clamp(30px,9vw,40px)] leading-tight text-white lg:text-[52px]">
            {view.state.queue.name} is ready for you.
          </p>
          {/* Plain white. A tinted white on this ground drops back under
              4.5:1, so the step down in hierarchy is size, not opacity. */}
          <p className="mt-3 font-mono text-[12px] leading-[1.6] text-white">
            Show this screen if anyone asks.
          </p>

          <div className="mt-10 flex-1 lg:hidden" />

          <div className="mt-8 space-y-2 lg:max-w-xs">
            <Button variant="onSignal" fullWidth>
              On my way
            </Button>
            <Button variant="ghostOnSignal" fullWidth onClick={onCancel}>
              I need two minutes
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/**
 * The phone is the ticket's shell on mobile. On a larger screen the pass
 * becomes a centred composition instead of a column pinned to the left edge.
 *
 * The theme control disappears from state 03 onwards: at that point the
 * customer is being called, and nothing should compete with the number.
 */
function Shell({
  children,
  connection,
  surface,
  showToggle = false,
}: {
  children: ReactNode;
  connection: ConnectionState;
  surface?: "flip" | "signal";
  showToggle?: boolean;
}): JSX.Element {
  return (
    <div
      data-surface={surface}
      className="min-h-dvh bg-shell transition-colors duration-500 motion-reduce:transition-none"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 py-6 lg:max-w-[1000px] lg:justify-center lg:px-10 lg:py-12">
        <header className="flex items-center justify-between">
          <MonoLabel size={10} tone="muted">
            Qless pass
          </MonoLabel>
          <div className="flex items-center gap-3">
            {showToggle && <ThemeToggle variant="quiet" />}
            <LiveIndicator state={connection} />
          </div>
        </header>

        {/* flex-none from lg, like the screens inside it: on a phone the pass
            fills the height so the cancel action sits at the bottom, and on a
            monitor it becomes a composition the shell centres. */}
        <main className="flex flex-1 flex-col gap-4 lg:flex-none">{children}</main>
      </div>
    </div>
  );
}

