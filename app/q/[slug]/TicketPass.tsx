"use client";

import { useCallback, type JSX, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Board } from "@/components/Board";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { LiveIndicator, type ConnectionState } from "@/components/LiveIndicator";
import { MonoLabel } from "@/components/Label";
import { Notice } from "@/components/Notice";
import { Numeral } from "@/components/Numeral";
import { Perforation, TicketBadge, TicketCard, TicketProgress } from "@/components/TicketCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
import { useStoredValue } from "@/hooks/useStoredValue";
import { useTurnNotifications, type AlertPermission } from "@/hooks/useTurnNotifications";
import { deriveBoardRows } from "@/lib/board";
import { writeSession } from "@/lib/session";
import { proximityOf, type CustomerView, type Proximity, type QueueEntry } from "@/lib/types";

interface TicketPassProps {
  view: CustomerView;
  entry: QueueEntry;
  connection: ConnectionState;
  onCancel: () => void;
}

/**
 * What the customer has told the counter about where they are. Held on this
 * phone for now: the counter cannot receive it until the API carries it, and
 * the screen says so rather than pretending.
 */
type Presence = "on-my-way" | "here" | "hold" | null;

function presenceKey(slug: string, number: number): string {
  return `qless.presence.${slug}.${number}`;
}

function usePresence(slug: string, number: number): [Presence, (next: Presence) => void] {
  const key = presenceKey(slug, number);
  const stored = useStoredValue(key);
  const presence: Presence =
    stored === "on-my-way" || stored === "here" || stored === "hold" ? stored : null;

  const set = useCallback(
    (next: Presence): void => {
      if (next === null) return;
      writeSession(key, next);
    },
    [key],
  );

  return [presence, set];
}

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

/**
 * The customer's whole product: where am I, how long, is it fair — in one
 * glance, on one screen.
 *
 * Four states form an escalation ladder carried by inversion rather than
 * colour. White on the page, then a full flip to ink, then the whole screen in
 * vermilion. Only the last state is allowed the signal colour.
 */
export function TicketPass({ view, entry, connection, onCancel }: TicketPassProps): JSX.Element {
  const proximity = proximityOf(entry, view.peopleAhead);
  const announcement = announcementFor(proximity, entry, view);
  const [presence, setPresence] = usePresence(view.state.queue.slug, entry.number);

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
      <TurnScreen view={view} entry={entry} onCancel={onCancel} presence={presence} setPresence={setPresence} />
    ) : proximity === "next" ? (
      <NextScreen
        view={view}
        entry={entry}
        connection={connection}
        onCancel={onCancel}
        presence={presence}
        setPresence={setPresence}
      />
    ) : (
      <WaitingScreen
        view={view}
        entry={entry}
        connection={connection}
        onCancel={onCancel}
        close={proximity === "close"}
        alerts={alerts}
        presence={presence}
        setPresence={setPresence}
      />
    );

  return (
    <>
      {/* Outside the screens rather than inside one of them: escalating
          replaces the whole screen, and a live region inserted with the change
          is not reliably announced — it has to have been there first. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {screen}
    </>
  );
}

/**
 * The opt-in, said in terms of what is still ahead. At six away the three
 * nudges are all to come; at one away only the last one is, and promising
 * "three away" to someone who is second in line reads as a screen that has
 * not noticed where they are.
 */
function alertsCopy(peopleAhead: number): ReactNode {
  if (peopleAhead > 3) {
    return (
      <>
        at <span className="text-strong">three away</span>, one away, and your turn
      </>
    );
  }
  if (peopleAhead > 1) {
    return (
      <>
        at <span className="text-strong">one away</span> and your turn
      </>
    );
  }
  return (
    <>
      the moment <span className="text-strong">it&rsquo;s your turn</span>
    </>
  );
}

function AlertsNotice({
  permission,
  peopleAhead,
  onRequest,
}: {
  permission: AlertPermission;
  peopleAhead: number;
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
        We can nudge you {alertsCopy(peopleAhead)}. Your place is held either way.
      </Notice>
    );
  }

  return (
    <Notice tone="quiet" chip="!">
      {permission === "granted" ? (
        <>Alerting you {alertsCopy(peopleAhead)}. Your place is held if you close this.</>
      ) : permission === "denied" ? (
        <>
          Alerts are blocked for this site, so keep an eye on this page. Your place is held if you
          close it.
        </>
      ) : (
        <>Keep this page open and it will keep up. Your place is held if you close it.</>
      )}
    </Notice>
  );
}

/** States 01 and 02 — the ticket on the page. */
function WaitingScreen({
  view,
  entry,
  connection,
  onCancel,
  close,
  alerts,
  presence,
  setPresence,
}: TicketPassProps & {
  close: boolean;
  alerts: { permission: AlertPermission; request: () => void };
  presence: Presence;
  setPresence: (next: Presence) => void;
}): JSX.Element {
  const rows = deriveBoardRows({
    servingNumber: view.state.servingNumber,
    waitingNumbers: view.state.waitingNumbers,
    myNumber: entry.number,
  });
  const oneAhead = view.peopleAhead === 1;

  return (
    <Shell connection={connection} showToggle>
      <div className="flex flex-1 flex-col gap-4 lg:grid lg:flex-none lg:grid-cols-[1fr_360px] lg:items-start lg:gap-6">
        <TicketCard className="p-[22px] lg:p-8">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[22px] font-medium leading-tight tracking-[-0.02em] text-paper-ink lg:text-[26px]">
              {view.state.queue.name}
            </h1>
            <TicketBadge inverted={close}>{close ? "Getting close" : "In queue"}</TicketBadge>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4 lg:mt-8">
            <div className="min-w-0">
              <MonoLabel size={10} tone="paper">
                Your number
              </MonoLabel>
              <Numeral value={entry.number} scale="hero" className="mt-2 text-paper-ink lg:text-[150px]" />
            </div>

            <dl className="shrink-0 space-y-3 text-right lg:space-y-5">
              <div>
                <MonoLabel as="dt" size={10} tone="paper">
                  Now serving
                </MonoLabel>
                <dd>
                  <Numeral value={view.state.servingNumber} scale="small" className="mt-1 text-paper-ink lg:text-[40px]" />
                </dd>
              </div>
              <div>
                <MonoLabel as="dt" size={10} tone="paper">
                  Ahead
                </MonoLabel>
                <dd>
                  <Numeral value={view.peopleAhead} scale="small" className="mt-1 text-paper-ink lg:text-[40px]" />
                </dd>
              </div>
            </dl>
          </div>

          <Perforation className="-mx-[22px] my-5 lg:-mx-8 lg:my-7" />

          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <MonoLabel size={10} tone="paper">
                Estimated wait
              </MonoLabel>
              <p className="numeral mt-1.5 text-[clamp(28px,8vw,36px)] text-paper-ink lg:text-[42px]">
                {view.estimate?.label ?? "Almost there"}
              </p>
            </div>

            {/* Only while there is somewhere to head back from. Second in
                line, the walk is already over. */}
            {close && !oneAhead && (
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
              {oneAhead
                ? "One person ahead of you. We'll tell you the moment it's your turn."
                : `${view.peopleAhead} ahead of you. About five minutes' walk is all you have.`}
            </Notice>
          )}

          {!close && (
            <AlertsNotice
              permission={alerts.permission}
              peopleAhead={view.peopleAhead}
              onRequest={alerts.request}
            />
          )}

          <div className="flex-1 lg:hidden" />

          <div className="space-y-2">
            {close && <PresencePanel stage="close" presence={presence} onSet={setPresence} />}
            <Button variant="ghost" fullWidth onClick={onCancel}>
              Cancel my place
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/** State 03 — the screen flips against the base theme. */
function NextScreen({
  view,
  entry,
  connection,
  onCancel,
  presence,
  setPresence,
}: TicketPassProps & { presence: Presence; setPresence: (next: Presence) => void }): JSX.Element {
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
            <h1 className="text-[22px] font-medium leading-tight tracking-[-0.02em] lg:text-[26px]">
              {view.state.queue.name}
            </h1>
            <TicketBadge className="border-current bg-transparent">You&rsquo;re next</TicketBadge>
          </div>

          <div className="mt-5 lg:mt-8">
            <MonoLabel size={10} tone="inherit" className="ticket-flip-muted">
              Your number
            </MonoLabel>
            <Numeral value={entry.number} scale="next" className="mt-2 lg:text-[180px]" />
          </div>

          <div aria-hidden="true" className="-mx-[22px] my-5 flex h-6 items-center lg:-mx-8 lg:my-7">
            <span className="h-6 w-3 rounded-r-full bg-shell" />
            <span className="ticket-flip-line h-px flex-1 border-t border-dashed" />
            <span className="h-6 w-3 rounded-l-full bg-shell" />
          </div>

          <p className="text-[24px] font-medium leading-tight tracking-[-0.02em] lg:text-[30px]">
            {view.state.servingNumber === null
              ? "You're up next."
              : `You're up after ${view.state.servingNumber}.`}
          </p>
          <p className="ticket-flip-muted mt-3 text-[13.5px] leading-[1.55]">
            Be inside now. If you&rsquo;re not here when you&rsquo;re called, you&rsquo;ll be skipped and
            can rejoin.
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-4 lg:flex-none">
          <Board rows={rows} />

          <div className="flex-1 lg:hidden" />

          <div className="space-y-2">
            <PresencePanel stage="next" presence={presence} onSet={setPresence} />
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
function TurnScreen({
  view,
  entry,
  onCancel,
  presence,
  setPresence,
}: Omit<TicketPassProps, "connection"> & {
  presence: Presence;
  setPresence: (next: Presence) => void;
}): JSX.Element {
  return (
    <Shell connection="called" surface="signal">
      <div className="flex flex-1 flex-col gap-6 lg:grid lg:flex-none lg:grid-cols-[auto_1fr] lg:items-center lg:gap-16">
        <div>
          {/* The screen's heading, and the only one it has. Set at label size
              because the numeral under it is the thing being announced. */}
          <h1 className="text-[13px] font-medium uppercase tracking-[0.06em] text-white">
            It&rsquo;s your turn
          </h1>
          <Numeral value={entry.number} scale="turn" className="mt-3 text-white lg:text-[280px]" />
        </div>

        <div className="lg:border-l lg:border-white/35 lg:pl-16">
          <hr className="mb-6 border-0 border-t border-white/35 lg:hidden" />

          <p className="text-[clamp(26px,8vw,34px)] font-medium leading-tight tracking-[-0.02em] text-white lg:text-[44px]">
            {view.state.queue.name} is ready for you.
          </p>
          {/* Plain white. A tinted white on this ground drops back under
              4.5:1, so the step down in hierarchy is size, not opacity. */}
          <p className="mt-3 text-[13.5px] leading-[1.55] text-white">Show this screen if anyone asks.</p>

          <div className="mt-10 flex-1 lg:hidden" />

          <div className="mt-8 space-y-2 lg:max-w-xs">
            <PresencePanel stage="current" presence={presence} onSet={setPresence} onSignal />
            <button
              type="button"
              onClick={onCancel}
              className="block w-full py-2 text-center text-[13px] text-white/90 underline-offset-4 hover:underline"
            >
              Cancel my place
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/**
 * What the customer can tell the counter, and only what moves things forward
 * from where they are.
 *
 *   getting close  — "I'm on my way", then "I'm here" once that is said
 *   you're next    — "I'm here", or the confirmation once it is said
 *   your turn      — "I'm here" with "I need two minutes" beneath it, or, for
 *                    someone already here, just "Go to the counter"
 *
 * Once "I'm here" is said nothing else is asked: two minutes is only for
 * somebody who is not here. Each tap is recorded on this phone and the panel
 * says so, until the API carries it to the counter.
 */
function PresencePanel({
  stage,
  presence,
  onSet,
  onSignal = false,
}: {
  stage: "close" | "next" | "current";
  presence: Presence;
  onSet: (next: Presence) => void;
  onSignal?: boolean;
}): JSX.Element {
  const here = presence === "here";
  const primary = onSignal ? "onSignal" : "contrast";
  const secondary = onSignal ? "ghostOnSignal" : "ghost";
  const line = onSignal ? "text-center text-[13px] leading-[1.55] text-white" : "text-center text-[13px] leading-[1.55] text-muted";
  const held = onSignal ? "mt-1.5 text-center text-[12px] text-white/90" : "mt-1.5 text-center text-[12px] text-muted";
  const done = onSignal
    ? "flex h-[46px] items-center justify-center gap-2 rounded-full border border-white/70 text-[15px] font-medium text-white"
    : "flex h-[46px] items-center justify-center gap-2 rounded-full border border-faint text-[15px] font-medium text-strong";

  if (here) {
    return (
      <div>
        <div className={done}>
          <Icon icon={Check} size={16} />
          {stage === "current" ? "You're here" : "You're marked as here"}
        </div>
        <p className={held}>
          {stage === "current"
            ? "Go to the counter."
            : stage === "next"
              ? "Wait to be called."
              : "Held on this phone for now."}
        </p>
      </div>
    );
  }

  if (stage === "close") {
    return presence === "on-my-way" ? (
      <div className="space-y-2">
        <div className={done}>
          <Icon icon={Check} size={16} />
          On my way
        </div>
        <Button variant={primary} fullWidth onClick={() => onSet("here")}>
          I&rsquo;m here
        </Button>
      </div>
    ) : (
      <Button variant={primary} fullWidth onClick={() => onSet("on-my-way")}>
        I&rsquo;m on my way
      </Button>
    );
  }

  if (stage === "next") {
    return (
      <Button variant={primary} fullWidth onClick={() => onSet("here")}>
        I&rsquo;m here
      </Button>
    );
  }

  // Your turn, and not here yet.
  return (
    <div className="space-y-2">
      <Button variant={primary} fullWidth onClick={() => onSet("here")}>
        I&rsquo;m here
      </Button>
      {/* A hold, not a cancel: two minutes is a request, and the number
          stays theirs for one more call. */}
      {presence === "hold" ? (
        <p className={line}>Holding your number for one more call. Nothing is cancelled.</p>
      ) : (
        <Button variant={secondary} fullWidth onClick={() => onSet("hold")}>
          I need two minutes
        </Button>
      )}
    </div>
  );
}

/**
 * The phone is the ticket's shell on mobile. On a larger screen the pass
 * becomes a centred composition instead of a column pinned to the left edge.
 *
 * The appearance control disappears from state 03 onwards: at that point the
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
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 py-5 lg:max-w-[1000px] lg:justify-center lg:px-10 lg:py-12">
        <header className="flex items-center justify-between">
          <Wordmark size={20} />
          <div className="flex items-center gap-3">
            {showToggle && <ThemeToggle variant="quiet" />}
            <LiveIndicator state={connection} />
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 lg:flex-none">{children}</main>
      </div>
    </div>
  );
}
