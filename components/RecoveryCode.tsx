"use client";

import { useState, type JSX } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { MonoLabel } from "@/components/Label";
import { Notice } from "@/components/Notice";
import { Perforation, TicketCard } from "@/components/TicketCard";
import { Wordmark } from "@/components/Wordmark";
import { useOrigin } from "@/hooks/useStoredValue";

interface RecoveryCodeProps {
  code: string;
  /** The business the code belongs to, so a downloaded file names itself. */
  queueName?: string;
  /** What the button says once the code has been saved. */
  continueLabel: string;
  onContinue: () => void;
  /** Shown under the buttons while the acknowledgement is in flight. */
  saving?: boolean;
}

/**
 * The recovery code, shown once.
 *
 * This is the only screen in the product that a person genuinely cannot leave
 * and come back to, so it is the one place a forced acknowledgement is
 * justified: the code is not stored anywhere retrievable, and the next screen
 * cannot show it again. The checkbox is not a dark pattern in reverse — it is
 * the difference between an owner who can recover their business and one who
 * cannot.
 *
 * It is rendered on ticket stock because that is what it is: a stub you keep.
 */
export function RecoveryCode({
  code,
  queueName,
  continueLabel,
  onContinue,
  saving = false,
}: RecoveryCodeProps): JSX.Element {
  const [acknowledged, setAcknowledged] = useState(false);
  const origin = useOrigin();

  async function copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Recovery code copied");
    } catch {
      toast.error("Couldn't copy. Select the code and copy it manually.");
    }
  }

  function downloadCode(): void {
    const slug = (queueName ?? "qless").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const body = [
      "Qless recovery code",
      queueName ? `Business: ${queueName}` : null,
      "",
      code,
      "",
      "This code gets you back into your queues on a new device.",
      "Keep it somewhere only you can reach. Anyone who has it can run your queues.",
      "It is shown once and cannot be recovered — but you can redeem it to get a fresh one.",
    ]
      .filter((line) => line !== null)
      .join("\n");

    try {
      const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `qless-recovery-${slug || "code"}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Recovery code saved");
    } catch {
      toast.error("Couldn't save the file. Copy the code instead.");
    }
  }

  return (
    <div className="recovery-sheet">
      {/* The masthead the paper copy needs and the screen already has. On
          /create and /enter the page's own header is dropped at print. */}
      <div className="hidden print:mb-9 print:flex print:items-center print:justify-between print:gap-4">
        <Wordmark asLink={false} />
        <span
          className="text-[12px] text-muted"
          suppressHydrationWarning
        >
          Issued {new Date().toLocaleDateString()}
        </span>
      </div>

      <h1 className="text-[clamp(30px,7vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
        Save your recovery code
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-[1.6] text-dim">
        This is how you get back to your queues on a new phone or a new laptop. We show it once and
        we cannot show it again.
      </p>

      <TicketCard className="recovery-ticket mt-8 p-[22px]">
        {queueName && (
          <p className="mb-4 hidden text-[22px] font-medium leading-tight tracking-[-0.02em] text-paper-ink print:block">
            {queueName}
          </p>
        )}

        <MonoLabel size={10} tone="paper">
          Recovery code
        </MonoLabel>

        <p className="mt-3 break-all font-mono text-[clamp(20px,6vw,28px)] leading-[1.3] tracking-[0.08em] text-paper-ink">
          {code}
        </p>

        <Perforation className="-mx-[22px] my-5" notchColor="shell" />

        <p className="text-[13px] leading-[1.55] text-paper-muted">
          Anyone holding this code can run your queues. Keep it somewhere only you can reach — a
          password manager, or the drawer behind the till.
        </p>

        <p className="mt-3 hidden text-[13px] leading-[1.55] text-paper-muted print:block">
          Enter it at {origin || "the Qless site"}/enter on any device. Redeeming it issues a fresh
          code and retires this one, so print the replacement and shred this sheet.
        </p>
      </TicketCard>

      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <Button variant="ghost" onClick={() => void copyCode()}>
          Copy code
        </Button>
        <Button variant="ghost" onClick={downloadCode}>
          Download
        </Button>
        {/* The third way to keep it, and the one the drawer behind the till
            actually takes. The sheet cannot be reprinted from anywhere else:
            only the hash is stored, so this screen is the last moment the code
            exists in a form anything can render. */}
        <Button variant="ghost" onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <label className="mt-8 flex cursor-pointer items-start gap-3 print:hidden">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--strong)]"
        />
        <span className="text-[13.5px] leading-[1.55] text-dim">
          I&rsquo;ve saved my recovery code somewhere safe.
        </span>
      </label>

      <Button
        variant="paper"
        fullWidth
        className="mt-5 print:hidden"
        disabled={!acknowledged}
        loading={saving}
        onClick={onContinue}
      >
        {continueLabel}
      </Button>

      {!acknowledged && (
        <Notice tone="quiet" className="mt-4 print:hidden">
          Without this code, a lost device means a lost queue. There is no email to reset it to.
        </Notice>
      )}
    </div>
  );
}

