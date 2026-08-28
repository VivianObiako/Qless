"use client";

import { useEffect, useState, type JSX } from "react";
import Link from "next/link";
import { AccessNotice } from "@/components/AccessNotice";
import { MonoLabel } from "@/components/Label";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import { QueueArranging } from "@/components/QueueArranging";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
import { DashboardChrome } from "@/app/dashboard/[id]/DashboardChrome";
import { ApiError, getMyQueues } from "@/lib/api";
import {
  clearSession,
  getSessionRole,
  sessionTokenKey,
  type SessionRole,
} from "@/lib/session";
import { useIsClient, useStoredValue } from "@/hooks/useStoredValue";
import type { MyQueuesResponse, Queue } from "@/lib/types";

/**
 * The list this browser can open, answered by the server rather than assembled
 * from storage keys.
 *
 * Before sessions there was no list to build: a queue's token was stored under
 * that queue's own id, so nothing could enumerate them and every queue was an
 * unrelated bookmark. One token and one request replaces all of that.
 */
export function MyQueues(): JSX.Element {
  const isClient = useIsClient();
  const token = useStoredValue(sessionTokenKey());

  const [result, setResult] = useState<MyQueuesResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [endedAs, setEndedAs] = useState<SessionRole | null>(null);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    void (async () => {
      try {
        setResult(await getMyQueues(token, controller.signal));
        setError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (!(caught instanceof ApiError)) return;

        // This route is about the session rather than about any one queue, so a
        // 401 here needs no second request to interpret: the session is gone.
        // Drop it, and remember what it was, because a withdrawn operator and
        // a signed-out owner have different things to do next.
        if (caught.status === 401) {
          setEndedAs(getSessionRole());
          clearSession();
        }
        setError(caught);
      }
    })();

    return () => controller.abort();
  }, [token]);

  // The queue is named once, by the chrome, so this screen's own title is an
  // h2 under it rather than a second h1.
  function body(): JSX.Element {
    // Storage has not been read on the server, so "no token" is only true once
    // the client is running — otherwise this flashes its signed-out state.
    if (!isClient || (token && !result && !error)) {
      return <QueueArranging className="mx-auto max-w-md" label="Loading your queues" />;
    }

    if (error?.status === 401) {
      return <AccessNotice outcome="session-ended" role={endedAs} what="queues" />;
    }

    if (!token) {
      return <SignedOut />;
    }

    if (error || !result) {
      return (
        <Notice tone="standing" title="Couldn't load your queues" chip="!">
          {error?.message ?? "Try again in a moment."}
        </Notice>
      );
    }

    if (result.queues.length === 0) {
      return result.role === "OWNER" ? <NoQueuesYet /> : <NotAssigned />;
    }

    return (
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-serif text-[clamp(34px,8vw,46px)] leading-[0.95] tracking-[-0.03em] text-strong">
            Your queues.
          </h2>

          {result.role === "OWNER" && <LinkButton href="/create">New queue</LinkButton>}
        </div>

        <ul className="mt-9 flex flex-col gap-px overflow-hidden rounded-[var(--radius-panel)] bg-shell-line">
          {result.queues.map((queue) => (
            <QueueRow key={queue.id} queue={queue} />
          ))}
        </ul>

        <p className="mt-6 font-mono text-[11px] leading-[1.7] text-muted">
          {result.role === "OWNER"
            ? "You're signed in as the owner of these queues on this device."
            : "You're signed in as an operator. Your manager decides which queues appear here."}
        </p>
      </div>
    );
  }

  // No session, no menu. The drawer's own owner-only reading treats "no role"
  // as an owner, which is safe behind a dashboard nobody reaches without a
  // token and wrong on the one screen a signed-out person lands on.
  if (isClient && !token) {
    return <PlainShell>{body()}</PlainShell>;
  }

  return (
    <DashboardChrome tab="queues" heading="Your queues" width="narrow">
      {body()}
    </DashboardChrome>
  );
}

/** The shell for a visitor with nothing to navigate yet. */
function PlainShell({ children }: { children: JSX.Element }): JSX.Element {
  return (
    <div className="min-h-dvh bg-shell">
      <header className="border-b border-shell-mid">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5">
          <Wordmark />
          <ThemeToggle variant="quiet" className="sm:hidden" />
          <ThemeToggle className="hidden sm:inline-flex" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">{children}</main>
    </div>
  );
}

function QueueRow({ queue }: { queue: Queue }): JSX.Element {
  return (
    <li>
      <Link
        href={`/dashboard/${queue.id}`}
        className="flex items-center gap-5 bg-shell-soft px-6 py-5 transition-colors hover:bg-shell-mid"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-[22px] leading-tight text-strong">
            {queue.name}
          </span>
          <span className="mt-1.5 block truncate font-mono text-[11px] text-muted">
            /q/{queue.slug}
          </span>
        </span>

        {/* Only when it is not open. On a row you click, a pill reading "OPEN"
            is read as the button that opens it — and a queue being open is the
            unremarkable case anyway. Paused and closed are what a person
            scanning this list needs to catch. */}
        {queue.status !== "OPEN" && (
          <span className="shrink-0 rounded-[var(--radius-badge)] border border-current px-2 py-[5px] font-mono text-[9px] uppercase tracking-[0.18em] text-strong">
            {queue.status}
          </span>
        )}
      </Link>
    </li>
  );
}

function SignedOut(): JSX.Element {
  return (
    <div>
      <h1 className="font-serif text-[clamp(34px,8vw,46px)] leading-[0.95] tracking-[-0.03em] text-strong">
        Sign in with your code.
      </h1>
      <p className="mt-4 max-w-md font-mono text-[13px] leading-[1.7] text-dim">
        Qless has no passwords. Your recovery code — or the access code your manager gave you — is
        what brings your queues back on this device.
      </p>

      <div className="mt-9 flex flex-wrap gap-2">
        <LinkButton href="/enter">Enter a code</LinkButton>
        <LinkButton href="/create" variant="ghost">
          Create a queue
        </LinkButton>
      </div>
    </div>
  );
}

function NoQueuesYet(): JSX.Element {
  return (
    <div>
      <h1 className="font-serif text-[clamp(34px,8vw,46px)] leading-[0.95] tracking-[-0.03em] text-strong">
        No queues yet.
      </h1>
      <p className="mt-4 max-w-md font-mono text-[13px] leading-[1.7] text-dim">
        Create one and share its code. Everything else — the dashboard, the QR sheet, the customer
        view — comes with it.
      </p>

      <LinkButton href="/create" className="mt-9">
        Create a queue
      </LinkButton>
    </div>
  );
}

/**
 * An operator with nothing assigned is not broken and has done nothing wrong,
 * so this says what to do rather than reporting a failure.
 */
function NotAssigned(): JSX.Element {
  return (
    <div>
      <MonoLabel size={10} tone="muted">
        Signed in
      </MonoLabel>
      <h1 className="mt-3 font-serif text-[clamp(34px,8vw,46px)] leading-[0.95] tracking-[-0.03em] text-strong">
        No queues assigned.
      </h1>
      <p className="mt-4 max-w-md font-mono text-[13px] leading-[1.7] text-dim">
        Your code works — there is just nothing on it yet. Ask your manager to assign you a queue,
        then reload this page.
      </p>
    </div>
  );
}

