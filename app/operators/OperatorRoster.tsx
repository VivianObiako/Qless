"use client";

import { useEffect, useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";
import { AccessNotice } from "@/components/AccessNotice";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { MonoLabel } from "@/components/Label";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import { QueueArranging } from "@/components/QueueArranging";
import { Perforation, TicketCard } from "@/components/TicketCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
import { DashboardChrome } from "@/app/dashboard/[id]/DashboardChrome";
import {
  ApiError,
  createOperator,
  getMyQueues,
  getOperators,
  regenerateOperatorCode,
  revokeOperator,
  updateOperator,
} from "@/lib/api";
import type { AccessOutcome } from "@/lib/access";
import {
  clearSession,
  getSessionRole,
  sessionTokenKey,
  type SessionRole,
} from "@/lib/session";
import { useIsClient, useStoredValue } from "@/hooks/useStoredValue";
import type { Operator, Queue } from "@/lib/types";

/**
 * The owner's roster.
 *
 * An operator's code is not a password and not a recovery code: it is handed
 * over in person, it is reusable, and the owner can replace or withdraw it at
 * any moment. That is why nothing here asks for confirmation before issuing a
 * code, and everything asks before taking one away.
 */
export function OperatorRoster(): JSX.Element {
  const isClient = useIsClient();
  const token = useStoredValue(sessionTokenKey());

  const [operators, setOperators] = useState<Operator[] | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [access, setAccess] = useState<AccessOutcome | null>(null);
  const [endedAs, setEndedAs] = useState<SessionRole | null>(null);
  const [issued, setIssued] = useState<{ operator: Operator; code: string } | null>(null);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    void (async () => {
      // Settled rather than all: the roster is owner-only and the queue list is
      // not, so an operator who types this address into the bar gets a 401 from
      // one and a perfectly good answer from the other. That pair is the answer
      // — the session is fine, this screen is not theirs — and the earlier
      // version threw their session away for it.
      const [roster, mine] = await Promise.allSettled([
        getOperators(token, controller.signal),
        getMyQueues(token, controller.signal),
      ]);

      if (controller.signal.aborted) return;

      if (mine.status === "fulfilled") setQueues(mine.value.queues);

      if (roster.status === "fulfilled") {
        setOperators(roster.value.operators);
        setError(null);
        return;
      }

      const caught: unknown = roster.reason;
      if (!(caught instanceof ApiError)) return;
      setError(caught);

      if (caught.status !== 401) return;

      if (mine.status === "fulfilled") {
        setAccess("not-permitted");
        return;
      }
      if (mine.reason instanceof ApiError && mine.reason.status === 401) {
        setEndedAs(getSessionRole());
        clearSession();
        setAccess("session-ended");
      }
    })();

    return () => controller.abort();
  }, [token]);

  function replace(operator: Operator): void {
    setOperators((current) =>
      (current ?? []).map((existing) => (existing.id === operator.id ? operator : existing)),
    );
  }

  // The chrome names the page, so this screen's own title is an h2 under it.
  function body(): JSX.Element {
    if (!isClient || (token && !operators && !error)) {
      return <QueueArranging className="mx-auto max-w-md" label="Loading your team" />;
    }

    if (access !== null) {
      return <AccessNotice outcome={access} role={endedAs} what="team" />;
    }

    if (!token || error?.status === 401) {
      return (
        <Notice
          tone="standing"
          title="Sign in to manage your team"
          chip="!"
          action={<LinkButton href="/enter">Enter a code</LinkButton>}
        >
          Only the owner of these queues can add or remove operators.
        </Notice>
      );
    }

    if (error || !operators) {
      return (
        <Notice tone="standing" title="Couldn't load your team" chip="!">
          {error?.message ?? "Try again in a moment."}
        </Notice>
      );
    }

    if (issued) {
      return (
        <IssuedCode operator={issued.operator} code={issued.code} onDone={() => setIssued(null)} />
      );
    }

    return roster(operators, token);
  }

  function roster(all: Operator[], sessionToken: string): JSX.Element {
    const active = all.filter((operator) => operator.status === "ACTIVE");
    const revoked = all.filter((operator) => operator.status === "REVOKED");

    return (
    <div>
      <h2 className="font-sans text-[clamp(34px,8vw,46px)] leading-[0.95] tracking-[-0.03em] text-strong">
        Your team.
      </h2>
      <p className="mt-4 max-w-lg font-mono text-[13px] leading-[1.7] text-dim">
        Operators work the counter on the queues you assign them. They can serve, skip and pause —
        they cannot close a queue, clear it, change its settings, or see this screen.
      </p>

      {active.length > 0 && (
        <ul className="mt-9 flex flex-col gap-px overflow-hidden rounded-[var(--radius-panel)] bg-shell-line">
          {active.map((operator) => (
            <OperatorRow
              key={operator.id}
              operator={operator}
              queues={queues}
              token={sessionToken}
              onChanged={replace}
              onCodeIssued={(code) => setIssued({ operator, code })}
            />
          ))}
        </ul>
      )}

      <AddOperator
        queues={queues}
        token={sessionToken}
        onAdded={(operator, code) => {
          setOperators((current) => [...(current ?? []), operator]);
          setIssued({ operator, code });
        }}
      />

      {revoked.length > 0 && (
        <section className="mt-12">
          <MonoLabel as="h3" size={10} tone="muted">
            No longer working here
          </MonoLabel>
          <ul className="mt-4 flex flex-col gap-2">
            {revoked.map((operator) => (
              <li key={operator.id} className="font-mono text-[12px] text-muted">
                {operator.displayName} — access withdrawn. Kept so your history still says who did
                what.
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
    );
  }

  // No session, no menu — the drawer reads a missing role as an owner, which is
  // right behind a dashboard and wrong on a screen a signed-out person reaches.
  if (isClient && !token) {
    return <PlainShell>{body()}</PlainShell>;
  }

  return (
    <DashboardChrome tab="team" heading="Your team" width="narrow">
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

function OperatorRow({
  operator,
  queues,
  token,
  onChanged,
  onCodeIssued,
}: {
  operator: Operator;
  queues: Queue[];
  token: string;
  onChanged: (operator: Operator) => void;
  onCodeIssued: (code: string) => void;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assigned = new Set(operator.queueIds);

  async function run(work: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function toggleQueue(queueId: string): void {
    const next = assigned.has(queueId)
      ? operator.queueIds.filter((id) => id !== queueId)
      : [...operator.queueIds, queueId];

    void run(async () => {
      const result = await updateOperator(operator.id, { queueIds: next }, token);
      onChanged(result.operator);
    });
  }

  return (
    <li className="bg-shell-soft px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-sans text-[22px] leading-tight text-strong">
            {operator.displayName}
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-muted">
            {operator.queueIds.length === 0
              ? "No queues assigned"
              : `${operator.queueIds.length} of ${queues.length} queues`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const result = await regenerateOperatorCode(operator.id, token);
                onChanged(result.operator);
                if (result.accessCode) onCodeIssued(result.accessCode);
              })
            }
          >
            New code
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmingRevoke(true)}>
            Remove
          </Button>
        </div>
      </div>

      {queues.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {queues.map((queue) => {
            const on = assigned.has(queue.id);
            return (
              <button
                key={queue.id}
                type="button"
                disabled={busy}
                aria-pressed={on}
                onClick={() => toggleQueue(queue.id)}
                className={
                  on
                    ? "rounded-[var(--radius-badge)] border border-strong bg-strong px-2.5 py-[6px] font-mono text-[10px] uppercase tracking-[0.16em] text-shell transition-colors disabled:opacity-60"
                    : "rounded-[var(--radius-badge)] border border-shell-line px-2.5 py-[6px] font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-strong hover:text-strong disabled:opacity-60"
                }
              >
                {queue.name}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-strong">{error}</p>
      )}

      <ConfirmDialog
        open={confirmingRevoke}
        onOpenChange={setConfirmingRevoke}
        title={`Remove ${operator.displayName}?`}
        description="Their code stops working straight away and every device they are signed in on is signed out. They stay on your history so you can still see what they did."
        confirmLabel="Remove them"
        cancelLabel="Keep them"
        destructive
        loading={busy}
        onConfirm={() => {
          setConfirmingRevoke(false);
          void run(async () => {
            const result = await revokeOperator(operator.id, token);
            onChanged(result.operator);
            toast.success(`${operator.displayName} removed`);
          });
        }}
      />
    </li>
  );
}

function AddOperator({
  queues,
  token,
  onAdded,
}: {
  queues: Queue[];
  token: string;
  onAdded: (operator: Operator, code: string) => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter their name");
      return;
    }
    setNameError(null);
    setError(null);
    setSaving(true);

    try {
      const result = await createOperator({ displayName: trimmed, queueIds: selected }, token);
      setName("");
      setSelected([]);
      if (result.accessCode) onAdded(result.operator, result.accessCode);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="add-operator" className="mt-10">
      <MonoLabel as="h2" size={10} tone="muted" id="add-operator">
        Add someone
      </MonoLabel>

      <form onSubmit={onSubmit} noValidate className="mt-5 space-y-5">
        <Field
          label="Their name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={nameError}
          hint="Shown on your history so you can see who served whom."
          placeholder="Ada"
          maxLength={60}
          required
        />

        {queues.length > 0 && (
          <div>
            <MonoLabel size={10} tone="muted">
              Queues they can work
            </MonoLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {queues.map((queue) => {
                const on = selected.includes(queue.id);
                return (
                  <button
                    key={queue.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setSelected((current) =>
                        on ? current.filter((id) => id !== queue.id) : [...current, queue.id],
                      )
                    }
                    className={
                      on
                        ? "rounded-[var(--radius-badge)] border border-strong bg-strong px-2.5 py-[6px] font-mono text-[10px] uppercase tracking-[0.16em] text-shell"
                        : "rounded-[var(--radius-badge)] border border-shell-line px-2.5 py-[6px] font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-strong hover:text-strong"
                    }
                  >
                    {queue.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <Notice tone="standing" title="Couldn't add them" chip="!">
            {error}
          </Notice>
        )}

        <Button type="submit" variant="contrast" loading={saving}>
          Add operator
        </Button>
      </form>
    </section>
  );
}

/**
 * An access code, shown once. Unlike the owner's recovery code there is no
 * acknowledgement to make and no disaster if it is lost — the owner is standing
 * right here and can issue another.
 */
function IssuedCode({
  operator,
  code,
  onDone,
}: {
  operator: Operator;
  code: string;
  onDone: () => void;
}): JSX.Element {
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy. Read it out instead.");
    }
  }

  return (
    <div>
      <h1 className="font-sans text-[clamp(34px,8vw,46px)] leading-[0.95] tracking-[-0.03em] text-strong">
        {operator.displayName}&rsquo;s code.
      </h1>
      <p className="mt-4 max-w-md font-mono text-[13px] leading-[1.7] text-dim">
        Give this to them. They enter it once on each device they work from, and it keeps working
        until you replace it or remove them.
      </p>

      <TicketCard className="mt-9 p-[22px]">
        <MonoLabel size={10} tone="paper">
          Access code
        </MonoLabel>
        <p className="mt-3 break-all font-mono text-[clamp(20px,6vw,28px)] leading-[1.3] tracking-[0.08em] text-paper-ink">
          {code}
        </p>

        <Perforation className="-mx-[22px] my-5" notchColor="shell" />

        <p className="font-mono text-[11px] leading-[1.7] text-paper-muted">
          We will not show this again — but you can issue a new one whenever you like, which
          immediately retires this one.
        </p>
      </TicketCard>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => void copy()}>
          Copy code
        </Button>
        <Button variant="contrast" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

