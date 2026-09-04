"use client";

import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { LinkButton } from "@/components/LinkButton";
import { MonoLabel } from "@/components/Label";
import { Notice } from "@/components/Notice";
import { QrCode, downloadQrPng } from "@/components/QrCode";
import { Perforation, TicketCard } from "@/components/TicketCard";
import { RecoveryCode } from "@/components/RecoveryCode";
import { ApiError, createQueue } from "@/lib/api";
import { sessionTokenKey, setSession } from "@/lib/session";
import { useOrigin, useStoredValue } from "@/hooks/useStoredValue";
import type { CreateQueueResponse, Queue } from "@/lib/types";

export function CreateQueueForm(): JSX.Element {
  const [created, setCreated] = useState<CreateQueueResponse | null>(null);
  const [codeSaved, setCodeSaved] = useState(false);

  if (created) {
    // A recovery code comes back only when this request created the business.
    // It is shown once, before anything else, because the next screen cannot
    // show it again and no other copy of it exists.
    //
    // Nothing is acknowledged to the server here: acknowledgement promotes a
    // *staged* code, and a code issued at create has nothing behind it to
    // promote. That two-step belongs to recovery, on /enter.
    if (created.recoveryCode && !codeSaved) {
      return (
        <RecoveryCode
          code={created.recoveryCode}
          queueName={created.queue.name}
          continueLabel="Go to my queue"
          onContinue={() => setCodeSaved(true)}
        />
      );
    }
    return <QueueReady queue={created.queue} />;
  }

  return <Form onCreated={setCreated} />;
}

function Form({ onCreated }: { onCreated: (created: CreateQueueResponse) => void }): JSX.Element {
  // An owner who is already signed in gets this queue added to the business
  // they have, rather than starting a second one they can never merge.
  const session = useStoredValue(sessionTokenKey());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serviceMinutes, setServiceMinutes] = useState("15");
  const [capacity, setCapacity] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
    if (!Number.isFinite(minutes) || minutes < 1) {
      setError("Average service time must be at least one minute.");
      return;
    }

    const parsedCapacity = capacity.trim() === "" ? null : Number.parseInt(capacity, 10);
    if (parsedCapacity !== null && (!Number.isFinite(parsedCapacity) || parsedCapacity < 1)) {
      setError("Maximum queue size must be a whole number, or left empty for no limit.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await createQueue(
        {
          name: trimmedName,
          description: description.trim(),
          averageServiceMinutes: minutes,
          maxCapacity: parsedCapacity,
        },
        session,
      );
      setSession(result.ownerToken, "OWNER");
      onCreated(result);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-[clamp(30px,7vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
        Create a queue
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-[1.6] text-dim">
        No account needed. You&rsquo;ll get a link to share and a private dashboard to run it from.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        <Field
          label="Business or queue name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={nameError}
          placeholder="Ade's Barbershop"
          maxLength={80}
          autoComplete="organization"
          autoFocus
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
          hint="Used to estimate waits. You can change this later."
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

        {error && (
          <Notice tone="standing" title="Couldn't create the queue" chip="!">
            {error}
          </Notice>
        )}

        <Button type="submit" variant="paper" fullWidth loading={submitting}>
          Create queue
        </Button>
      </form>
    </div>
  );
}

const readyQrId = "queue-ready-qr";

function QueueReady({ queue }: { queue: Queue }): JSX.Element {
  const origin = useOrigin();

  const customerUrl = `${origin}/q/${queue.slug}`;

  // No `?k=` any more. The token is this browser's session, so the dashboard
  // link is just an address — and an address in a URL bar at a counter, in
  // browser history and in every screenshot is not where a credential belongs.
  const dashboardUrl = `/dashboard/${queue.id}`;

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(customerUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  }

  function downloadQr(): void {
    if (downloadQrPng(readyQrId, `qless-${queue.slug}.png`)) {
      toast.success("QR code saved");
    } else {
      toast.error("Couldn't save the QR code. Try the print sheet instead.");
    }
  }

  return (
    <div>
      <h1 className="text-[clamp(30px,7vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
        Your queue is ready
      </h1>

      <TicketCard className="mt-8 p-[22px]">
        <p className="text-[22px] font-medium leading-tight tracking-[-0.02em] text-paper-ink">{queue.name}</p>

        <Perforation className="-mx-[22px] my-5" />

        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <MonoLabel size={10} tone="paper">
              Customer link
            </MonoLabel>
            <p className="mt-1.5 break-all font-mono text-[13px] leading-relaxed text-paper-ink">
              {customerUrl || `/q/${queue.slug}`}
            </p>
            <MonoLabel size={10} tone="paper" className="mt-4 block">
              Scan to join
            </MonoLabel>
          </div>

          {/* Held back until the origin is known, so the code is never
              generated pointing at a relative path. */}
          {origin && (
            <QrCode
              id={readyQrId}
              value={customerUrl}
              label={`QR code to join the queue at ${queue.name}`}
              className="w-[124px] shrink-0"
            />
          )}
        </div>
      </TicketCard>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={copyLink}>
          Copy link
        </Button>
        <Button variant="ghost" onClick={downloadQr} disabled={!origin}>
          Download QR
        </Button>
        <LinkButton href={`/print/${queue.slug}`} variant="ghost">
          Print sheet
        </LinkButton>
        <LinkButton href={`/q/${queue.slug}`} variant="ghost">
          Open customer view
        </LinkButton>
      </div>

      <Notice
        tone="standing"
        title="This device is signed in"
        chip="!"
        className="mt-8"
        action={
          <LinkButton href={dashboardUrl} size="md">
            Open queue dashboard
          </LinkButton>
        }
      >
        This browser can run the queue from now on. On any other device, enter the recovery code you
        just saved — the dashboard link on its own opens nothing.
      </Notice>
    </div>
  );
}

