"use client";

import { useId, useRef, useState, type JSX, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { MonoLabel } from "@/components/Label";
import { LiveIndicator, type ConnectionState } from "@/components/LiveIndicator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
import { useStoredValue } from "@/hooks/useStoredValue";
import { sessionRoleKey } from "@/lib/session";
import { cn } from "@/lib/utils";

export type DashboardTab = "counter" | "history" | "settings" | "queues" | "operators";

interface DashboardChromeProps {
  tab: DashboardTab;
  children: ReactNode;
  /**
   * Absent on the business-level screens. Queues and operators belong to the
   * owner rather than to any one queue, so they are reached from the same menu
   * but have no counter behind them.
   */
  queueId?: string;
  /** Absent while a screen is still loading, and on every error state. */
  queueName?: string;
  /**
   * What the page is called when there is no queue name to show — a loading
   * counter, or a screen that belongs to the business rather than a queue.
   * Rendered unseen, because the visible title in those cases is the body's.
   */
  heading?: string;
  status?: string;
  customerHref?: string;
  connection?: ConnectionState;
  /**
   * The counter fills the screen; the rest are reading columns. The bar above
   * them keeps one width regardless, so moving between them never slides the
   * wordmark sideways.
   */
  width?: "wide" | "narrow";
}

interface Destination {
  id: DashboardTab;
  label: string;
  href: string;
  ownerOnly: boolean;
}

function queueDestinations(queueId: string): readonly Destination[] {
  return [
    { id: "counter", label: "Counter", href: `/dashboard/${queueId}`, ownerOnly: false },
    { id: "history", label: "History", href: `/dashboard/${queueId}/history`, ownerOnly: false },
    { id: "settings", label: "Settings", href: `/dashboard/${queueId}/settings`, ownerOnly: true },
  ];
}

const businessDestinations: readonly Destination[] = [
  { id: "queues", label: "Queues", href: "/queues", ownerOnly: false },
  { id: "operators", label: "Operators", href: "/operators", ownerOnly: true },
];

/**
 * The frame every dashboard screen sits in: the bar that names the queue, and
 * the drawer that reaches everything else.
 *
 * It is rendered by each screen's own client component rather than by a route
 * layout, because the things in the bar that change — the queue's name, its
 * status, the live dot — are that screen's state, and a layout sits above the
 * page it would have to read them from.
 */
export function DashboardChrome({
  tab,
  children,
  queueId,
  queueName,
  heading = "Queue dashboard",
  status,
  customerHref,
  connection,
  width = "wide",
}: DashboardChromeProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const handleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // The same reading the rest of the dashboard makes: a principal's type never
  // changes, so storage cannot go stale, and a browser holding only a
  // pre-session token is an owner by definition. This decides what is drawn.
  // The server checks every request regardless.
  const isOwner = useStoredValue(sessionRoleKey()) !== "OPERATOR";

  const permitted = (destination: Destination): boolean => isOwner || !destination.ownerOnly;

  function close(): void {
    setOpen(false);
    handleRef.current?.focus();
  }

  // Only ever reachable below 1280px, where the drawer overlays: above it the
  // handle is not rendered, so there is nothing to close and no need to ask
  // the viewport how wide it is.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      close();
    }
  }

  return (
    // A column so the row below can take the rest of the height: pinned, the
    // drawer is a side of the page and has to reach its bottom, and a short
    // screen would otherwise leave it hanging halfway down.
    <div data-surface="paper" className="flex min-h-dvh flex-col bg-shell">
      <header className="border-b border-shell-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-5">
            <Wordmark />
            {/* The page's heading. It lives in the bar because that is where the
                queue is named, and it names every section of it — which is why
                the other screens carry their own title as an h2 below. The
                error states have no queue to name, so they carry the same
                heading unseen rather than none. */}
            {queueName ? (
              <h1 className="font-sans text-[20px] leading-none text-strong">{queueName}</h1>
            ) : (
              <h1 className="sr-only">{heading}</h1>
            )}
          </div>

          {/* Four things, and two of them are state rather than controls. The
              theme and the customer view moved into the drawer's footer: both
              are reached occasionally, and taking them out of here is what
              stopped this bar wrapping into a second row on a tablet. */}
          <div className="flex items-center gap-4 sm:gap-5">
            {connection && <LiveIndicator state={connection} />}
            {status && (
              <span className="rounded-[var(--radius-badge)] border border-current px-2 py-[5px] font-mono text-[9px] uppercase tracking-[0.18em] text-strong">
                {status}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="relative flex flex-1" onKeyDown={onKeyDown}>
        {/* Absolute below 1280px so the counter keeps its full width and the
            panel lies over it; part of the row above that, where the page can
            spare the column. */}
        <div className="absolute inset-y-0 left-0 z-20 xl:static xl:w-[230px] xl:shrink-0">
          <nav
            id={panelId}
            data-open={open}
            aria-label="Dashboard"
            className={cn(
              "drawer-panel h-full w-[230px] border-r border-shell-line bg-shell-soft py-4",
              // A shadow is how this reads as lifted on the warm palette and
              // does nothing at all on #111, where the lighter surface and the
              // hairline carry it instead.
              "shadow-[6px_0_24px_rgb(26_23_20_/_0.16)] xl:shadow-none",
            )}
          >
            {queueId && (
              <Group label="This queue">
                {queueDestinations(queueId)
                  .filter(permitted)
                  .map((destination) => (
                    <Item key={destination.id} destination={destination} tab={tab} />
                  ))}
              </Group>
            )}

            <Group label="Your business" divided={queueId !== undefined}>
              {businessDestinations.filter(permitted).map((destination) => (
                <Item key={destination.id} destination={destination} tab={tab} />
              ))}
            </Group>

            {/* Drawn like the destinations above rather than like the labels
                above them: uppercase mono is this product's heading voice, and
                a link wearing it reads as a group nobody can open. */}
            <div className="mt-4 flex flex-col items-start gap-2 border-t border-shell-line pt-4">
              {/* A new tab, because the dashboard is the operator's working
                  screen and a counter has a queue running on it. Checking what
                  a customer sees should never cost them their place. */}
              {customerHref && (
                <a
                  href={customerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2 font-mono text-[12px] text-muted transition-colors hover:text-strong"
                >
                  Customer view ↗
                </a>
              )}
              <div className="px-4 pt-1">
                <ThemeToggle />
              </div>
            </div>
          </nav>
        </div>

        {/* The handle rides the panel's edge rather than sitting at the page's,
            so it is always attached to the thing it moves and its arrow is
            always honest about the next click. */}
        <button
          ref={handleRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((current) => !current)}
          style={{ transform: open ? "translateX(230px)" : "translateX(0)" }}
          className={cn(
            "absolute left-0 top-4 z-30 grid h-9 w-7 place-items-center xl:hidden",
            "rounded-r-[var(--radius-control)] bg-strong text-shell",
            "transition-transform duration-[220ms] ease-[cubic-bezier(0.65,0,0.35,1)]",
          )}
        >
          <Chevron pointing={open ? "left" : "right"} />
        </button>

        <main
          // The page makes room for the handle rather than letting it sit on
          // top of the first panel. Above 1280 the drawer is a real column and
          // the handle is gone, so the gutter goes back to normal.
          className={cn(
            "min-w-0 flex-1 pl-12 pr-6 xl:px-6",
            width === "narrow" ? "pb-24 pt-12" : "py-8",
          )}
        >
          <div className={cn("mx-auto", width === "narrow" ? "max-w-2xl" : "max-w-6xl")}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Group({
  label,
  children,
  divided = false,
}: {
  label: string;
  children: ReactNode;
  divided?: boolean;
}): JSX.Element {
  return (
    // Labelled rather than headed: the visible label is decoration and the nav
    // carries the name, so the drawer stays out of the page's heading outline.
    <nav aria-label={label} className={cn(divided && "mt-4 border-t border-shell-line pt-4")}>
      <MonoLabel size={10} tone="muted" aria-hidden className="block px-4 pb-2">
        {label}
      </MonoLabel>
      <ul>{children}</ul>
    </nav>
  );
}

function Item({ destination, tab }: { destination: Destination; tab: DashboardTab }): JSX.Element {
  const current = destination.id === tab;

  return (
    <li>
      <Link
        href={destination.href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "block border-l-2 px-4 py-2 font-mono text-[12px] transition-colors",
          // The marker is a bar on the left edge, which only works because the
          // panel is flush to the page's edge with no gutter to fight.
          current
            ? "border-strong bg-shell-mid text-strong"
            : "border-transparent text-muted hover:text-strong",
        )}
      >
        {destination.label}
      </Link>
    </li>
  );
}

function Chevron({ pointing }: { pointing: "left" | "right" }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={pointing === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
