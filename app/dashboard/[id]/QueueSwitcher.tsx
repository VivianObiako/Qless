"use client";

import { useEffect, useState, type JSX } from "react";
import Link from "next/link";
import { ApiError, getMyQueues } from "@/lib/api";
import { sessionTokenKey } from "@/lib/session";
import { useStoredValue } from "@/hooks/useStoredValue";
import { cn } from "@/lib/utils";
import type { Queue } from "@/lib/types";

/**
 * How anyone running more than one queue moves between them.
 *
 * Only rendered for someone with more than one, which is the whole of the test:
 * an owner with a single queue and an operator covering a single queue both
 * have nowhere to switch to, and see nothing. It fetches rather than reading
 * storage because assignments change under them — an owner adding a queue
 * should show up on the next load, not the next sign-in.
 */
export function QueueSwitcher({
  currentQueueId,
  className,
}: {
  currentQueueId: string;
  className?: string;
}): JSX.Element | null {
  const token = useStoredValue(sessionTokenKey());
  const [queues, setQueues] = useState<Queue[]>([]);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const mine = await getMyQueues(token, controller.signal);
        setQueues(mine.queues);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        // A switcher that cannot load is not worth an error on a working
        // dashboard: it simply does not appear.
        if (!(caught instanceof ApiError)) return;
      }
    })();

    return () => controller.abort();
  }, [token]);

  if (queues.length < 2) return null;

  return (
    <nav aria-label="Your queues" className={cn("flex flex-wrap items-center gap-2", className)}>
      {queues.map((queue) => {
        const current = queue.id === currentQueueId;
        return (
          <Link
            key={queue.id}
            href={`/dashboard/${queue.id}`}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-[var(--radius-badge)] border px-2.5 py-[6px] font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
              current
                ? "border-strong bg-strong text-shell"
                : "border-faint text-muted hover:border-strong hover:text-strong",
            )}
          >
            {queue.name}
          </Link>
        );
      })}
    </nav>
  );
}

