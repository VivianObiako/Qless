"use client";

import { useEffect, useState, type FormEvent, type JSX, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AccessNotice } from "@/components/AccessNotice";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import { QueueArranging } from "@/components/QueueArranging";
import { DashboardChrome } from "../DashboardChrome";
import { ApiError, actOnQueue, getOperatorView, updateQueue } from "@/lib/api";
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
import { MEASURE_SAMPLE, type Queue, type ServiceMeasure } from "@/lib/types";

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
  const [measured, setMeasured] = useState<ServiceMeasure>({ minutes: 0, sample: 0 });
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
        setMeasured(view.measured);
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

    return <Form queueId={queueId} queue={queue} measured={measured} token={token} onSaved={setQueue} />;
  }

  return (
    <DashboardChrome
      queueId={queueId}
      tab="settings"
      queueName={queue?.name}
      queueSlug={queue?.slug}
      width="narrow"
    >
      {body()}
    </DashboardChrome>
  );
}

function Form({
  queueId,
  queue,
  measured,
  token,
  onSaved,
}: {
  queueId: string;
  queue: Queue;
  measured: ServiceMeasure;
  token: string;
  onSaved: (queue: Queue) => void;
}): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState(queue.name);
  const [description, setDescription] = useState(queue.description);
  const [serviceMinutes, setServiceMinutes] = useState(String(queue.averageServiceMinutes));
  const [capacity, setCapacity] = useState(queue.maxCapacity === null ? "" : String(queue.maxCapacity));
  const [holdMinutes, setHoldMinutes] = useState(String(queue.holdMinutes));
  const [showNames, setShowNames] = useState(queue.showNamesToOperators);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function archive(): Promise<void> {
    setArchiving(true);
    try {
      await actOnQueue(queueId, "archive", token);
      toast.success(`${queue.name} is archived`);
      router.push("/queues");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Something went wrong.");
      setArchiving(false);
    }
  }

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

    const hold = holdMinutes.trim() === "" ? 0 : Number.parseInt(holdMinutes, 10);
    if (!Number.isFinite(hold) || hold < 0 || hold > 120) {
      setError("Hold time must be between 0 and 120 minutes.");
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
          holdMinutes: hold,
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
      <h2 className="text-[clamp(30px,6vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
        Settings
      </h2>

      <form onSubmit={onSubmit} noValidate className="mt-8">
        <Section title="Queue" description="What customers see when they scan in.">
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
        </Section>

        <Section title="Waiting" description="The estimate customers see, and how long the line can get.">
          <Field
            label="Average service time"
            type="number"
            inputMode="numeric"
            value={serviceMinutes}
            onChange={(event) => setServiceMinutes(event.target.value)}
            hint={measuredHint(measured)}
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
        </Section>

        <Section
          title="Holding a place"
          description="What happens when someone is called and isn't there."
        >
          <Field
            label="Hold time"
            type="number"
            inputMode="numeric"
            value={holdMinutes}
            onChange={(event) => setHoldMinutes(event.target.value)}
            hint="After this long the counter suggests a skip, a skipped number can still be called back for this long, and customers are told the figure. 0 means no hold: a skip is final."
            suffix="minutes"
            min={0}
            max={120}
          />
        </Section>

        <Section title="Privacy" description="Who sees customer names. Customers never see each other's.">
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <span>
              <span className="block text-[14.5px] font-medium text-strong">
                Show customer names to operators
              </span>
              <span className="mt-1 block text-[13px] leading-[1.6] text-muted">
                You always see names. Operators see numbers only unless this is on — a barbershop
                probably wants it, a clinic probably does not.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={showNames}
              onChange={(event) => setShowNames(event.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-faint transition-colors peer-checked:bg-strong peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-strong after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-shell after:transition-transform peer-checked:after:translate-x-4"
            />
          </label>
        </Section>

        {error && (
          <Notice tone="standing" title="Couldn't save your changes" chip="!" className="mt-6">
            {error}
          </Notice>
        )}

        <div className="mt-8 flex flex-wrap gap-2 border-t border-shell-line pt-6">
          <Button type="submit" variant="contrast" size="md" loading={saving}>
            Save settings
          </Button>
        </div>
      </form>

      <Section
        title="Archive"
        description="Put this queue away. Nothing is deleted."
      >
        <div>
          <p className="text-[13.5px] leading-[1.6] text-dim">
            An archived queue closes, leaves your list and stops taking joins. Its history stays, and
            you can restore it from your queues at any time.
          </p>
          <Button variant="ghost" size="md" className="mt-4" onClick={() => setConfirmingArchive(true)}>
            Archive this queue
          </Button>
        </div>
      </Section>

      <ConfirmDialog
        open={confirmingArchive}
        onOpenChange={setConfirmingArchive}
        title={`Archive ${queue.name}?`}
        description="It closes and leaves your list. Everyone waiting keeps their number but nobody new can join, and the print sheet on the door stops working until you restore it."
        confirmLabel="Archive"
        cancelLabel="Keep it"
        destructive
        loading={archiving}
        onConfirm={() => void archive()}
      />
    </div>
  );
}

/**
 * The service-time hint says which figure the estimates are actually using,
 * so the number in the box is never mistaken for the number on the pass.
 */
function measuredHint(measured: ServiceMeasure): string {
  if (measured.sample >= MEASURE_SAMPLE) {
    return `Measured lately: ${measured.minutes} min across the last ${measured.sample} served. Estimates are using that figure, not this one.`;
  }
  if (measured.sample > 0) {
    return `Measured so far: ${measured.minutes} min across ${measured.sample} served. Estimates switch to the measured figure after ${MEASURE_SAMPLE}.`;
  }
  return "Used to estimate waits until the day has produced real service times.";
}

/**
 * A settings section as two columns: what it is and why on the left, the
 * fields on the right. Stacks on a phone.
 */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="grid gap-5 border-t border-shell-line py-7 first:border-t-0 first:pt-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div>
        <h3 className="text-[15px] font-medium text-strong">{title}</h3>
        <p className="mt-1 max-w-[30ch] text-[13px] leading-[1.55] text-muted">{description}</p>
      </div>
      <div className="flex max-w-lg flex-col gap-5">{children}</div>
    </section>
  );
}
