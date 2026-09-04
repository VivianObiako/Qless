"use client";

import { useEffect, useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";
import { AccessNotice } from "@/components/AccessNotice";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import { QueueArranging } from "@/components/QueueArranging";
import { DashboardChrome } from "../DashboardChrome";
import { ApiError, getOperatorView, updateQueue } from "@/lib/api";
import { classifyUnauthorized, type AccessOutcome } from "@/lib/access";
import {
  clearSession,
  getSessionRole,
  ownerTokenKey,
  sessionRoleKey,
  sessionTokenKey,
  type SessionRole,
} from "@/lib/session";
import { useIsClient, useStoredValue } from "@/hooks/useStoredValue";
import type { Queue } from "@/lib/types";

/**
 * The queue's own configuration. Owner-only, and the server says so on every
 * request — this screen being reachable is not what makes it allowed.
 */
export function QueueSettingsForm({ queueId }: { queueId: string }): JSX.Element {
  const isClient = useIsClient();
  const sessionToken = useStoredValue(sessionTokenKey());
  const legacyToken = useStoredValue(ownerTokenKey(queueId));
  const token = sessionToken ?? legacyToken;

  // The same reading the chrome makes to hide this screen's tab, made again
  // here because a tab is not a door: the address can be typed. It decides what
  // is drawn and nothing more — the save below is refused by the server on its
  // own authority, whatever this component renders.
  const isOwner = useStoredValue(sessionRoleKey()) !== "OPERATOR";

  const [queue, setQueue] = useState<Queue | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [access, setAccess] = useState<AccessOutcome | null>(null);
  const [endedAs, setEndedAs] = useState<SessionRole | null>(null);

  useEffect(() => {
    // An operator is turned away below rather than by this fetch, so there is
    // nothing to ask for: the entries route would answer them perfectly well,
    // being the same call the counter makes, and the answer would only ever
    // fill in a form they are about to be told they cannot use.
    if (!token || !isOwner) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const view = await getOperatorView(queueId, token, controller.signal);
        setQueue(view.queue);
        setLoadError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (!(caught instanceof ApiError)) return;
        setLoadError(caught);

        if (caught.status !== 401) return;

        // An operator never gets this far, so a 401 here is an owner who has
        // wandered onto somebody else's queue, or a session that has stopped
        // working — "not yours" rather than "signed out", and in the first case
        // their session is worth keeping. Only the server can tell those two
        // apart; see classifyUnauthorized.
        const outcome = await classifyUnauthorized(token);
        if (outcome === null) return;
        if (outcome === "session-ended") {
          setEndedAs(getSessionRole());
          clearSession();
        }
        setAccess(outcome);
      }
    })();

    return () => controller.abort();
  }, [queueId, token, isOwner]);

  // The queue is named once, by the chrome, so this screen's own title is an
  // h2 under it rather than a second h1.
  function body(): JSX.Element {
    if (!isClient || (token && !queue && !loadError)) {
      return <QueueArranging className="mx-auto max-w-md" label="Loading settings" />;
    }

    if (access !== null) {
      return <AccessNotice outcome={access} role={endedAs} what="queue" />;
    }

    if (!token || loadError?.status === 401) {
      return (
        <Notice
          tone="standing"
          title="Sign in to change these settings"
          chip="!"
          action={<LinkButton href="/enter">Enter a code</LinkButton>}
        >
          Only the owner of this queue can change its settings.
        </Notice>
      );
    }

    if (loadError || !queue) {
      return (
        <Notice tone="standing" title="Couldn't load this queue" chip="!">
          {loadError?.message ?? "Try again in a moment."}
        </Notice>
      );
    }

    return <Form queueId={queueId} queue={queue} token={token} onSaved={setQueue} />;
  }

  return (
    <DashboardChrome
      queueId={queueId}
      tab="settings"
      queueName={queue?.name}
      width="narrow"
    >
      {body()}
    </DashboardChrome>
  );
}

function Form({
  queueId,
  queue,
  token,
  onSaved,
}: {
  queueId: string;
  queue: Queue;
  token: string;
  onSaved: (queue: Queue) => void;
}): JSX.Element {
  const [name, setName] = useState(queue.name);
  const [description, setDescription] = useState(queue.description);
  const [serviceMinutes, setServiceMinutes] = useState(String(queue.averageServiceMinutes));
  const [capacity, setCapacity] = useState(queue.maxCapacity === null ? "" : String(queue.maxCapacity));
  const [showNames, setShowNames] = useState(queue.showNamesToOperators);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Enter a name for your queue");
      return;
    }
    setNameError(null);

    const minutes = Number.parseInt(serviceMinutes, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480) {
      setError("Average service time must be between 1 and 480 minutes.");
      return;
    }

    const parsedCapacity = capacity.trim() === "" ? null : Number.parseInt(capacity, 10);
    if (parsedCapacity !== null && (!Number.isFinite(parsedCapacity) || parsedCapacity < 1)) {
      setError("Maximum queue size must be a whole number, or left empty for no limit.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Capacity is always sent, including as null: null is how "no limit" is
      // expressed, and leaving it out would mean "don't change it".
      const view = await updateQueue(
        queueId,
        {
          name: trimmedName,
          description: description.trim(),
          averageServiceMinutes: minutes,
          maxCapacity: parsedCapacity,
          showNamesToOperators: showNames,
        },
        token,
      );
      onSaved(view.queue);
      toast.success("Settings saved");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="font-sans text-[clamp(34px,8vw,46px)] leading-[0.95] tracking-[-0.03em] text-strong">
        Settings.
      </h2>

      <form onSubmit={onSubmit} noValidate className="mt-10 space-y-6">
        <Field
          label="Business or queue name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={nameError}
          hint="Changing this does not change your queue's link."
          maxLength={80}
          required
        />

        <Field
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          hint="Optional. Shown to customers when they join."
          placeholder="Walk-ins welcome"
          maxLength={200}
        />

        <Field
          label="Average service time"
          type="number"
          inputMode="numeric"
          value={serviceMinutes}
          onChange={(event) => setServiceMinutes(event.target.value)}
          hint="Used to estimate waits."
          suffix="minutes"
          min={1}
          max={480}
          required
        />

        <Field
          label="Maximum queue size"
          type="number"
          inputMode="numeric"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          hint="Optional. Leave empty for no limit."
          placeholder="No limit"
          suffix="people"
          min={1}
          max={1000}
        />

        <div className="rounded-[var(--radius-control)] border border-shell-line bg-shell-soft p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={showNames}
              onChange={(event) => setShowNames(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--strong)]"
            />
            <span>
              <span className="block font-mono text-[12px] leading-[1.6] text-strong">
                Show customer names to operators
              </span>
              <span className="mt-1.5 block font-mono text-[11px] leading-[1.7] text-muted">
                You always see names. Operators you add see numbers only unless you turn this on — a
                barbershop probably wants it, a clinic probably does not.
              </span>
            </span>
          </label>
        </div>

        {error && (
          <Notice tone="standing" title="Couldn't save your changes" chip="!">
            {error}
          </Notice>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="contrast" loading={saving}>
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}
