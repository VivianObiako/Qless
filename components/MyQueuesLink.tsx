"use client";

import type { JSX } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { sessionTokenKey } from "@/lib/session";
import { useIsClient, useStoredValue } from "@/hooks/useStoredValue";

/**
 * The way back into your own queues, shown only to a browser that has a session.
 *
 * Rendered client-side on purpose. The server has no idea who is asking — there
 * is no cookie and no account — so anything it emitted here would be wrong for
 * one of the two audiences and would have to be corrected on hydration.
 * Rendering nothing until the client knows is the honest version of that.
 */
export function MyQueuesLink({ className }: { className?: string }): JSX.Element | null {
  const isClient = useIsClient();
  const session = useStoredValue(sessionTokenKey());

  if (!isClient || !session) return null;

  return (
    <Link
      href="/queues"
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-strong",
        className,
      )}
    >
      My queues
    </Link>
  );
}
