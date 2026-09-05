"use client";

import type { JSX } from "react";
import Link from "next/link";
import { Mark } from "@/components/Mark";
import { cn } from "@/lib/utils";
import { sessionTokenKey } from "@/lib/session";
import { useIsClient, useStoredValue } from "@/hooks/useStoredValue";

interface WordmarkProps {
  className?: string;
  asLink?: boolean;
  /** Mark size in px. 22 in a nav bar, 26 on the print sheet. */
  size?: number;
}

/**
 * The stub locked up with the wordmark. The same mark as the browser favicon
 * (app/icon.svg) and the home-screen icon, so the tab and the header are one
 * identity rather than two.
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
      <Mark size={size} className="shrink-0 text-strong" />
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
