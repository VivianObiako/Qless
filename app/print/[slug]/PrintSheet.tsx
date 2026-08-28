"use client";

import { useEffect, useState, type JSX } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { MonoLabel } from "@/components/Label";
import { Notice } from "@/components/Notice";
import { QrCode } from "@/components/QrCode";
import { QueueArranging } from "@/components/QueueArranging";
import { Wordmark } from "@/components/Wordmark";
import { ApiError, getQueue } from "@/lib/api";
import { ownerTokenKey, sessionTokenKey } from "@/lib/session";
import { useOrigin, useStoredValue } from "@/hooks/useStoredValue";
import type { QueueSummary } from "@/lib/types";

/**
 * The sheet an operator tapes to the door or stands on the counter.
 *
 * It is a static page on purpose: no queue numbers, no counts, nothing that
 * goes stale between printing it and someone reading it. The only live thing on
 * a printed sheet is the code, and the code never changes.
 */
export function PrintSheet({ slug }: { slug: string }): JSX.Element {
  const [queue, setQueue] = useState<QueueSummary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const origin = useOrigin();

  // This page is public, so the way back to the dashboard is only offered to a
  // browser that is signed in. The legacy per-queue key is still read for a
  // browser that predates sessions; its id arrives with the fetch and hooks
  // cannot wait for it, so an empty key simply reads nothing.
  const sessionToken = useStoredValue(sessionTokenKey());
  const legacyToken = useStoredValue(queue ? ownerTokenKey(queue.id) : "");
  const signedIn = sessionToken ?? legacyToken;

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const view = await getQueue(slug, null, controller.signal);
        setQueue(view.state.queue);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (caught instanceof ApiError) setError(caught);
      }
    })();

    return () => controller.abort();
  }, [slug]);

  if (error) {
    return (
      <Frame>
        <Notice tone="standing" title="We couldn't find this queue" chip="!">
          {error.message}
        </Notice>
      </Frame>
    );
  }

  if (!queue) {
    return (
      <Frame>
        <QueueArranging label="Loading the sheet" />
      </Frame>
    );
  }

  const customerUrl = `${origin}/q/${queue.slug}`;

  return (
    <Frame>
      <div className="print-actions mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-5">
          {signedIn && (
            <Link
              href={`/dashboard/${queue.id}`}
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-strong"
            >
              ← Dashboard
            </Link>
          )}
          <Link
            href={`/q/${queue.slug}`}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-strong"
          >
            Customer view
          </Link>
        </div>
        <Button variant="contrast" size="md" onClick={() => window.print()}>
          Print this sheet
        </Button>
      </div>

      {/* A4 proportions on screen so what the operator sees is what comes out
          of the printer. */}
      <article className="print-sheet mx-auto flex aspect-[1/1.414] w-full flex-col items-center justify-between rounded-[var(--radius-panel)] bg-shell-soft px-10 py-12 text-center">
        <Wordmark asLink={false} size={26} />

        <div className="flex flex-col items-center">
          <h1 className="font-serif text-[clamp(30px,6vw,44px)] leading-[1.05] tracking-[-0.02em] text-strong">
            {queue.name}
          </h1>

          <MonoLabel size={11} tone="muted" tracking="wide" className="mt-4">
            Scan to join the queue
          </MonoLabel>

          {/* The square is held open whether or not the origin is known yet, so
              the sheet an operator is about to print does not re-lay itself out
              under them the moment the code appears. */}
          <div className="mt-6 aspect-square w-[min(58%,240px)]">
            {origin && (
              <QrCode
                value={customerUrl}
                // Printed at poster size, so the bitmap is generated well above
                // what the screen needs.
                size={1024}
                label={`QR code to join the queue at ${queue.name}`}
                className="h-full"
              />
            )}
          </div>

          <p className="mt-5 break-all font-mono text-[11px] leading-relaxed text-muted">
            {customerUrl || `/q/${queue.slug}`}
          </p>
        </div>

        <p className="font-mono text-[11px] leading-[1.8] text-muted">
          No app. No account.
          <br />
          Take a number and we&rsquo;ll hold your place.
        </p>
      </article>
    </Frame>
  );
}

/**
 * The print surface rather than the dark shell: this is a document, and it is
 * going to be printed. On paper the shell tokens resolve to ink on cream, which
 * prints as black on white once the browser drops background colours. It stays
 * light in either theme — the dashboard follows the theme, a printed page
 * cannot.
 */
function Frame({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div data-surface="print" className="min-h-dvh bg-shell px-5 py-8">
      <main className="mx-auto w-full max-w-[540px]">{children}</main>
    </div>
  );
}

