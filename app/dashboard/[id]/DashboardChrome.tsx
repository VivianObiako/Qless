"use client";

import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { History, Share2, SlidersHorizontal, Ticket, type LucideIcon } from "lucide-react";
import { Icon } from "@/components/Icon";
import { LiveIndicator, type ConnectionState } from "@/components/LiveIndicator";
import { Wordmark } from "@/components/Wordmark";
import { useIsClient, useStoredValue } from "@/hooks/useStoredValue";
import { sessionRoleKey, sessionTokenKey } from "@/lib/session";
import { cn } from "@/lib/utils";
import { PersonalMenu } from "./PersonalMenu";
import { QueueSwitcher, StatusDot } from "./QueueSwitcher";
import type { QueueStatus } from "@/lib/types";

export type DashboardTab = "counter" | "history" | "share" | "settings" | "queues" | "team";

interface DashboardChromeProps {
  tab: DashboardTab;
  children: ReactNode;
  /**
   * Absent on the business-level screens. Queues and the team belong to the
   * owner rather than to any one queue, so they are reached from the switcher
   * and the personal menu and have no counter behind them.
   */
  queueId?: string;
  /** Absent while a screen is still loading, and on every error state. */
  queueName?: string;
  /**
   * What the page is called when there is no queue name to show — a loading
   * counter, or a screen that belongs to the business rather than a queue.
   */
  heading?: string;
  status?: QueueStatus;
  connection?: ConnectionState;
  /**
   * The counter fills the screen; the rest are reading columns. The bar above
   * them keeps one width regardless, so moving between them never slides
   * anything sideways.
   */
  width?: "wide" | "narrow";
}

interface Destination {
  id: DashboardTab;
  label: string;
  href: string;
  icon: LucideIcon;
  ownerOnly: boolean;
}

function queueDestinations(queueId: string): readonly Destination[] {
  return [
    { id: "counter", label: "Counter", href: `/dashboard/${queueId}`, icon: Ticket, ownerOnly: false },
    { id: "history", label: "History", href: `/dashboard/${queueId}/history`, icon: History, ownerOnly: false },
    { id: "share", label: "Share", href: `/dashboard/${queueId}/share`, icon: Share2, ownerOnly: false },
    { id: "settings", label: "Settings", href: `/dashboard/${queueId}/settings`, icon: SlidersHorizontal, ownerOnly: true },
  ];
}

const statusWord: Record<QueueStatus, string> = {
  OPEN: "Open",
  PAUSED: "Paused",
  CLOSED: "Closed",
};

/**
 * The frame every dashboard screen sits in.
 *
 * A sidebar built around three questions, top to bottom: which queue (the
 * switcher), what am I doing (the queue's four screens), who am I (the
 * personal menu). Below 1024px the sidebar becomes a bar with the switcher on
 * the left and the menu on the right, and the four screens become a row of
 * tabs under it.
 *
 * It is rendered by each screen's own client component rather than by a route
 * layout, because the things in the bar that change — the queue's name, its
 * status, the live dot — are that screen's state, and a layout sits above the
 * page it would have to read them from.
 *
 * A browser with no session gets a bare frame: the wordmark and a way in. That
 * is what a revoked operator sees the moment their session is cleared, rather
 * than a menu full of places they can no longer go.
 */
export function DashboardChrome({
  tab,
  children,
  queueId,
  queueName,
  heading = "Queue dashboard",
  status,
  connection,
  width = "wide",
}: DashboardChromeProps): JSX.Element {
  const isClient = useIsClient();
  const token = useStoredValue(sessionTokenKey());
  const isOwner = useStoredValue(sessionRoleKey()) !== "OPERATOR";

  const title = queueName ?? heading;

  if (isClient && !token) {
    return <SignedOutFrame title={title}>{children}</SignedOutFrame>;
  }

  const destinations = queueId
    ? queueDestinations(queueId).filter((destination) => isOwner || !destination.ownerOnly)
    : [];

  return (
    <div className="flex min-h-dvh flex-col bg-shell lg:flex-row">
      {/* The sidebar, from lg. Pinned to the viewport and exactly its height,
          so a long counter scrolls past it rather than dragging it along. */}
      <aside className="hidden w-[236px] shrink-0 flex-col gap-4 self-start border-r border-shell-line px-3 py-4 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <QueueSwitcher currentQueueId={queueId} />

        {destinations.length > 0 && (
          <nav aria-label="This queue">
            <ul className="flex flex-col gap-px">
              {destinations.map((destination) => (
                <SideItem key={destination.id} destination={destination} current={destination.id === tab} />
              ))}
            </ul>
          </nav>
        )}

        <PersonalMenu className="mt-auto" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The top row. No line under it and no title in it: the page's own
            heading is the only title, as in the reference. On a desktop the
            row carries the queue's state at the right and keeps its height
            even when empty, so headings sit at the same height on every
            screen. On a phone it carries the switcher and the menu, with the
            four screens as tabs on a hairline beneath. */}
        <header>
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3 sm:px-8 lg:min-h-14 lg:justify-end lg:px-12 lg:py-0">
            <div className="min-w-0 lg:hidden">
              <QueueSwitcher currentQueueId={queueId} />
            </div>
            <h1 className="sr-only">{title}</h1>

            <div className="flex shrink-0 items-center gap-4">
              {connection && <LiveIndicator state={connection} />}
              {status && (
                <span className="inline-flex items-center gap-2 text-[13px] text-dim">
                  <StatusDot status={status} />
                  {statusWord[status]}
                </span>
              )}
              <PersonalMenu variant="avatar" opens="down" className="lg:hidden" />
            </div>
          </div>

          {destinations.length > 0 && (
            <nav aria-label="This queue" className="overflow-x-auto border-b border-shell-line px-5 sm:px-8 lg:hidden">
              <ul className="flex gap-5">
                {destinations.map((destination) => (
                  <TabItem key={destination.id} destination={destination} current={destination.id === tab} />
                ))}
              </ul>
            </nav>
          )}
        </header>

        {/* One column for every screen. It is capped and sits in the middle
            of the pane on a wide monitor, so the content is neither glued to
            the corner nor stretched across it, and its left edge is the same
            on every screen: a narrow screen stops short of the column's right
            edge rather than centring itself on its own. */}
        <main className="min-w-0 flex-1 py-6 pb-24 lg:pb-24 lg:pt-8">
          <div className="mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-12">
            <div className={cn(width === "narrow" && "max-w-2xl")}>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SideItem({ destination, current }: { destination: Destination; current: boolean }): JSX.Element {
  return (
    <li>
      <Link
        href={destination.href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] transition-colors",
          current ? "bg-shell-mid font-medium text-strong" : "text-dim hover:bg-shell-mid hover:text-strong",
        )}
      >
        <Icon icon={destination.icon} size={16} className={current ? "text-strong" : "text-muted"} />
        {destination.label}
      </Link>
    </li>
  );
}

function TabItem({ destination, current }: { destination: Destination; current: boolean }): JSX.Element {
  return (
    <li className="shrink-0">
      <Link
        href={destination.href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "-mb-px flex items-center gap-1.5 border-b-2 py-2.5 text-[13.5px] transition-colors",
          current ? "border-strong font-medium text-strong" : "border-transparent text-dim hover:text-strong",
        )}
      >
        <Icon icon={destination.icon} size={14} />
        {destination.label}
      </Link>
    </li>
  );
}

/** The frame for a browser that holds no session: nowhere to go but in. */
function SignedOutFrame({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="min-h-dvh bg-shell">
      <header className="border-b border-shell-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Wordmark />
          <Link href="/enter" className="text-[13.5px] font-medium text-strong underline-offset-4 hover:underline">
            Enter a code
          </Link>
        </div>
      </header>
      <h1 className="sr-only">{title}</h1>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-10">{children}</main>
    </div>
  );
}
