"use client";

import { useEffect, useState, type JSX } from "react";
import { toast } from "sonner";
import { ExternalLink, Monitor, Printer } from "lucide-react";
import { AccessNotice } from "@/components/AccessNotice";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import { QrCode, downloadQrPng } from "@/components/QrCode";
import { QueueArranging } from "@/components/QueueArranging";
import { DashboardChrome } from "../DashboardChrome";
import { ApiError, getOperatorView } from "@/lib/api";
import { classifyUnauthorized, type AccessOutcome } from "@/lib/access";
import {
  clearSession,
  getSessionRole,
  ownerTokenKey,
  sessionTokenKey,
  type SessionRole,
} from "@/lib/session";
import { useIsClient, useOrigin, useStoredValue } from "@/hooks/useStoredValue";
import type { Queue } from "@/lib/types";

const shareQrId = "share-qr";

/**
 * How customers get in, on its own screen.
 *
 * It used to sit under the counter, where an operator set it up once and then
 * scrolled past it all day. Here it holds everything that leaves the shop:
 * the link, the code, the print sheet, the wall display and the customer's
 * own view — and "turn the tablet round so they can scan it" is one tap away
 * from the counter rather than a scroll.
 */
export function ShareQueue({ queueId }: { queueId: string }): JSX.Element {
  const isClient = useIsClient();
  const sessionToken = useStoredValue(sessionTokenKey());
  const legacyToken = useStoredValue(ownerTokenKey(queueId));
  const token = sessionToken ?? legacyToken;

  const [queue, setQueue] = useState<Queue | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [access, setAccess] = useState<AccessOutcome | null>(null);
  const [endedAs, setEndedAs] = useState<SessionRole | null>(null);

  useEffect(() => {
    if (!token) return;

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
  }, [queueId, token]);

  function body(): JSX.Element {
    if (!isClient || (token && !queue && !loadError)) {
      return <QueueArranging className="mx-auto max-w-md" label="Loading the queue" />;
    }

    if (access !== null) {
      return <AccessNotice outcome={access} role={endedAs} what="queue" />;
    }

    if (!token || loadError?.status === 401) {
      return (
        <Notice
          tone="standing"
          title="Sign in to share this queue"
          chip="!"
          action={<LinkButton href="/enter">Enter a code</LinkButton>}
        >
          The people who run this queue are the ones who hand out its code.
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

    return <Sharing queue={queue} />;
  }

  return (
    <DashboardChrome
      queueId={queueId}
      tab="share"
      queueName={queue?.name}
      queueSlug={queue?.slug}
      width="narrow"
    >
      {body()}
    </DashboardChrome>
  );
}

function Sharing({ queue }: { queue: Queue }): JSX.Element {
  const origin = useOrigin();
  const customerUrl = `${origin}/q/${queue.slug}`;

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(customerUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  }

  function downloadQr(): void {
    if (downloadQrPng(shareQrId, `qless-${queue.slug}.png`)) {
      toast.success("QR code saved");
    } else {
      toast.error("Couldn't save the QR code. Try the print sheet instead.");
    }
  }

  return (
    <div>
      <h2 className="text-[clamp(30px,6vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
        Share
      </h2>
      <p className="mt-3 max-w-lg text-[14.5px] leading-[1.6] text-dim">
        Everything that lets a customer in. The code and the link never change, even if the
        queue is renamed.
      </p>

      <section className="mt-9 flex flex-col gap-6 rounded-[12px] border border-shell-line p-6 sm:flex-row sm:items-center sm:gap-8">
        {origin && (
          <QrCode
            id={shareQrId}
            value={customerUrl}
            label={`QR code to join the queue at ${queue.name}`}
            className="w-[160px] shrink-0"
          />
        )}
        <div className="min-w-0">
          <p className="text-[13px] text-muted">Scan to join</p>
          <p className="mt-1 break-all font-mono text-[13.5px] leading-relaxed text-strong">
            {customerUrl || `/q/${queue.slug}`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="contrast" size="md" onClick={copyLink}>
              Copy link
            </Button>
            <Button variant="ghost" size="md" onClick={downloadQr} disabled={!origin}>
              Download QR
            </Button>
          </div>
        </div>
      </section>

      <ul className="mt-4 flex flex-col overflow-hidden rounded-[12px] border border-shell-line">
        <ShareRow
          href={`/print/${queue.slug}`}
          icon={Printer}
          title="Print sheet"
          detail="A page for the door or the counter: the code, the name, one instruction."
        />
        <ShareRow
          href={`/display/${queue.slug}`}
          icon={Monitor}
          title="Display board"
          detail="Now serving and up next, for a screen on the wall. Opens in a new tab."
          external
        />
        <ShareRow
          href={`/q/${queue.slug}`}
          icon={ExternalLink}
          title="Customer view"
          detail="What a customer sees after scanning. Opens in a new tab, so the counter stays put."
          external
        />
      </ul>
    </div>
  );
}

function ShareRow({
  href,
  icon,
  title,
  detail,
  external = false,
}: {
  href: string;
  icon: typeof Printer;
  title: string;
  detail: string;
  external?: boolean;
}): JSX.Element {
  const classes =
    "flex items-center gap-4 border-t border-shell-line px-5 py-4 transition-colors first:border-t-0 hover:bg-shell-mid";
  const content = (
    <>
      <Icon icon={icon} size={18} className="text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium text-strong">{title}</span>
        <span className="block text-[13px] text-muted">{detail}</span>
      </span>
      {external && <Icon icon={ExternalLink} size={14} className="text-faint" />}
    </>
  );

  return (
    <li>
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
          {content}
        </a>
      ) : (
        <a href={href} className={classes}>
          {content}
        </a>
      )}
    </li>
  );
}
