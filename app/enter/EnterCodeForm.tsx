"use client";

import { useState, type FormEvent, type JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { RecoveryCode } from "@/components/RecoveryCode";
import { ApiError, acknowledgeRecoveryCode, redeemAccessCode } from "@/lib/api";
import { setSession } from "@/lib/session";
import type { RedeemResponse } from "@/lib/types";

/**
 * Where a code becomes a session.
 *
 * The queue id in a URL grants nothing; this is the only door. What the person
 * types decides who they are, and the server answers with the role and the
 * queues — so this screen never has to ask "are you an owner or an operator?".
 */
export function EnterCodeForm(): JSX.Element {
  const [redeemed, setRedeemed] = useState<RedeemResponse | null>(null);

  // An owner's code is rotated the moment it is redeemed, so the replacement
  // has to be put in front of them before they go anywhere.
  if (redeemed?.recoveryCode) {
    return <RotatedCode redeemed={redeemed} code={redeemed.recoveryCode} />;
  }

  return <Form onRedeemed={setRedeemed} />;
}

/** Where a redeemed session lands. */
function destinationFor(redeemed: RedeemResponse): string {
  // An operator who covers exactly one queue has one job, and it is that
  // queue's counter. Everyone else gets the list — an owner needs it to reach
  // the queue they did not just create.
  if (redeemed.role === "OPERATOR" && redeemed.queues.length === 1) {
    return `/dashboard/${redeemed.queues[0].id}`;
  }
  return "/queues";
}

function Form({ onRedeemed }: { onRedeemed: (redeemed: RedeemResponse) => void }): JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [limited, setLimited] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmed = code.trim();
    if (!trimmed) {
      setCodeError("Enter your code");
      return;
    }

    setCodeError(null);
    setLimited(null);
    setError(null);
    setSubmitting(true);

    try {
      const result = await redeemAccessCode(trimmed);
      setSession(result.token, result.role);

      if (result.recoveryCode) {
        onRedeemed(result);
        return;
      }
      router.replace(destinationFor(result));
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "invalid_code") {
        // Field errors are set in uppercase mono, which is built for a few
        // words. The server's sentence is written for a notice; here it would
        // shout. It also says nothing this does not.
        setCodeError("That code isn't valid");
      } else if (caught instanceof ApiError && caught.status === 429) {
        // Not a field error: nothing about what they typed was rejected, and
        // putting it under the input would send them off checking a code that
        // may be perfectly good.
        setLimited(caught.message);
      } else {
        setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
      }
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="font-serif text-[clamp(38px,10vw,52px)] leading-[0.95] tracking-[-0.03em] text-strong">
        Enter your code.
      </h1>
      <p className="mt-4 max-w-md font-mono text-[13px] leading-[1.7] text-dim">
        Your recovery code if you own the queues, or the access code your manager gave you. We work
        out the rest.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-10 space-y-6">
        <Field
          label="Code"
          mono
          value={code}
          onChange={(event) => setCode(event.target.value)}
          error={codeError}
          hint="Spacing and capitals don't matter."
          placeholder="XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={40}
          autoFocus
          required
        />

        {limited && (
          <Notice tone="standing" title="Too many attempts" chip="!">
            {limited} The limit is on this connection rather than on your code, and it lifts on its
            own — so wait it out rather than trying a different code.
          </Notice>
        )}

        {error && (
          <Notice tone="standing" title="Couldn't check that code" chip="!">
            {error}
          </Notice>
        )}

        <Button type="submit" variant="paper" fullWidth loading={submitting}>
          Continue
        </Button>
      </form>

      <p className="mt-8 font-mono text-[11px] leading-[1.7] text-muted">
        Don&rsquo;t have a code?{" "}
        <Link href="/create" className="text-strong underline underline-offset-4">
          Create a queue
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Redeeming rotates the code, and the replacement is only live once we say we
 * have it. Acknowledging is therefore the last thing that happens, after the
 * owner has ticked the box — until then their old code still works, which is
 * exactly the safety net the two-step exists for.
 */
function RotatedCode({ redeemed, code }: { redeemed: RedeemResponse; code: string }): JSX.Element {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await acknowledgeRecoveryCode(redeemed.token);
      // Replace rather than push: going back to a code that has just been
      // retired would show a screen that can never work again.
      router.replace(destinationFor(redeemed));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div>
      <RecoveryCode
        code={code}
        continueLabel="Continue"
        saving={saving}
        onContinue={() => void onContinue()}
      />

      {error && (
        <Notice tone="standing" title="Couldn't finish signing in" chip="!" className="mt-4">
          {error} Your previous code still works, so nothing is lost.
        </Notice>
      )}
    </div>
  );
}

