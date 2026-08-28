"use client";

import type { JSX } from "react";
import Link from "next/link";
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
 * Logo option B — paper chip carrying a serif Q, locked up with the mono
 * wordmark. Drawn entirely from the ticket's own vocabulary, and legible at
 * 20px and in black-and-white print.
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
        className="grid shrink-0 place-items-center rounded-[var(--radius-control)] bg-chip-bg text-chip-fg"
        style={{ width: size, height: size }}
      >
        <span
          className="font-serif leading-none"
          style={{ fontSize: size * 0.64, marginTop: size * 0.04 }}
        >
          Q
        </span>
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-strong">Qless</span>
    </span>
  );

  if (!asLink) return content;

  return (
    <Link href={href} className="inline-flex rounded-[var(--radius-control)]">
      {content}
    </Link>
  );
}
