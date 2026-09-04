"use client";

import type { JSX } from "react";
import Link from "next/link";
import { QMark } from "@/components/QMark";
import { cn } from "@/lib/utils";
import { sessionTokenKey } from "@/lib/session";
import { useIsClient, useStoredValue } from "@/hooks/useStoredValue";

interface WordmarkProps {
  className?: string;
  asLink?: boolean;
  /** Chip size in px. 22 in a nav bar, 44 on the landing hero. */
  size?: number;
}

/**
 * Logo option B — ink chip carrying the Q mark, locked up with the wordmark. The same mark as the browser favicon (app/icon.svg), so the tab
 * and the header are one identity rather than two different Q's.
 *
 * Home is not a fixed address. For a visitor it is the landing page; for anyone
 * holding a session it is their queues, which is the screen they actually came
 * back for. Both roles share that home today — an operator's list is simply
 * shorter.
 */
export function Wordmark({ className, asLink = true, size = 22 }: WordmarkProps): JSX.Element {
  const isClient = useIsClient();
  const session = useStoredValue(sessionTokenKey());

  // Rendered as the visitor's home until the client is running, so hydration
  // never has to reconcile two different destinations.
  const href = isClient && session ? "/queues" : "/";

  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="grid shrink-0 place-items-center rounded-[6px] bg-chip-bg text-chip-fg"
        style={{ width: size, height: size }}
      >
        <QMark size={size * 0.64} />
      </span>
      <span className="text-[15px] font-medium tracking-[-0.01em] text-strong">Qless</span>
    </span>
  );

  if (!asLink) return content;

  return (
    <Link href={href} className="inline-flex rounded-[6px]">
      {content}
    </Link>
  );
}
