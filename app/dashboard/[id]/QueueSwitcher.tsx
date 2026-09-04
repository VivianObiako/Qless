"use client";

import { useEffect, useState, type JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Layers, Plus } from "lucide-react";
import { Icon } from "@/components/Icon";
import { Mark } from "@/components/Mark";
import { ApiError, getMyQueues } from "@/lib/api";
import { sessionRoleKey, sessionTokenKey } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useStoredValue } from "@/hooks/useStoredValue";
import type { Queue, QueueStatus } from "@/lib/types";

interface QueueSwitcherProps {
  /** Absent on the business-level screens, where no queue is chosen. */
  currentQueueId?: string;
  /** The current queue's name when the screen already knows it, so the row is right before the list arrives. */
  currentQueueName?: string;
  /** What to show while the list is loading or when no queue is chosen. */
  fallbackLabel?: string;
  className?: string;
}

/**
 * The list, kept across mounts. Every dashboard screen renders its own chrome,
 * so the switcher is remounted on every navigation; without this it would
 * refetch each time and flash its empty state while it waited.
 */
let remembered: { token: string; queues: Queue[] } | null = null;

const statusWord: Record<QueueStatus, string> = {
  OPEN: "Open",
  PAUSED: "Paused",
  CLOSED: "Closed",
};

/**
 * The top of the sidebar: which queue you are in, and one click to any other.
 *
 * It answers the first of the three questions the sidebar is built around —
 * which queue, what am I doing, who am I — so it sits above everything else.
 * The list is fetched rather than read from storage because assignments
 * change under an operator: a queue added by the owner shows up on the next
 * load, not the next sign-in.
 */
export function QueueSwitcher({
  currentQueueId,
  currentQueueName,
  fallbackLabel = "Your queues",
  className,
}: QueueSwitcherProps): JSX.Element {
  const token = useStoredValue(sessionTokenKey());
  const isOwner = useStoredValue(sessionRoleKey()) !== "OPERATOR";
  const pathname = usePathname();
  const [queues, setQueues] = useState<Queue[]>(() =>
    remembered && remembered.token === token ? remembered.queues : [],
  );
  const { open, setOpen, toggle, containerRef, triggerRef, panelId } = useDisclosure();

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const mine = await getMyQueues(token, controller.signal);
        remembered = { token, queues: mine.queues };
        setQueues(mine.queues);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        // A switcher that cannot load is not worth an error on a working
        // dashboard: it simply lists nothing.
        if (!(caught instanceof ApiError)) return;
      }
    })();

    return () => controller.abort();
  }, [token]);

  // Navigating closes it. The chrome is re-rendered per screen, but a switch
  // between two dashboards keeps this component mounted.
  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close on route change only
  }, [pathname]);

  const current = queues.find((queue) => queue.id === currentQueueId) ?? null;
  const label = current?.name ?? currentQueueName ?? fallbackLabel;
  // Always two lines, so the row never changes height while the list loads.
  const sub =
    queues.length === 0
      ? "\u00a0"
      : queues.length === 1
        ? "1 queue"
        : `${queues.length} queues`;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[10px] border border-transparent px-2 py-1.5 text-left",
          "transition-colors hover:border-shell-line",
          open && "border-shell-line bg-shell-mid",
        )}
      >
        <Mark size={24} className="text-strong" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-strong">{label}</span>
          <span className="block text-[11.5px] text-muted">{sub}</span>
        </span>
        <Icon icon={ChevronsUpDown} size={14} className="text-muted" />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className={cn(
          "absolute left-0 top-full z-30 mt-1.5 w-[260px] rounded-[12px] border border-shell-line bg-shell-soft p-1.5",
          "shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_12px_32px_rgb(0_0_0_/_0.10)]",
        )}
      >
        <p className="px-2.5 pb-1 pt-1.5 text-[11.5px] text-muted">Switch queue</p>

        {queues.length === 0 ? (
          <p className="px-2.5 pb-2 text-[13px] text-muted">No queues yet.</p>
        ) : (
          <ul>
            {queues.map((queue) => {
              const isCurrent = queue.id === currentQueueId;
              return (
                <li key={queue.id}>
                  <Link
                    href={`/dashboard/${queue.id}`}
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13.5px] text-strong",
                      "transition-colors hover:bg-shell-mid",
                      isCurrent && "bg-shell-mid",
                    )}
                  >
                    <StatusDot status={queue.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{queue.name}</span>
                      <span className="block text-[12px] text-muted">
                        {statusWord[queue.status]}
                      </span>
                    </span>
                    {isCurrent && <Icon icon={Check} size={14} className="text-strong" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="my-1.5 h-px bg-shell-line" />

        <Link
          href="/queues"
          className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13.5px] text-strong transition-colors hover:bg-shell-mid"
        >
          <Icon icon={Layers} size={15} className="text-muted" />
          All queues
        </Link>
        {isOwner && (
          <Link
            href="/create"
            className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13.5px] text-strong transition-colors hover:bg-shell-mid"
          >
            <Icon icon={Plus} size={15} className="text-muted" />
            New queue
          </Link>
        )}
      </div>
    </div>
  );
}

/** Solid is open, hollow is paused, grey is closed. The word is always beside it. */
export function StatusDot({ status, className }: { status: QueueStatus; className?: string }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-[7px] shrink-0 rounded-full",
        status === "OPEN" && "bg-strong",
        status === "PAUSED" && "border-[1.5px] border-strong bg-transparent",
        status === "CLOSED" && "bg-faint",
        className,
      )}
    />
  );
}
