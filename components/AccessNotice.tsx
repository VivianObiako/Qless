import type { JSX } from "react";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import type { AccessOutcome } from "@/lib/access";
import type { SessionRole } from "@/lib/session";

interface AccessNoticeProps {
  outcome: AccessOutcome;
  /** The role this browser held when access ended. Decides who to send them to. */
  role?: SessionRole | null;
  /** What they were trying to reach — "this queue", "your team", "this history". */
  what: string;
}

/**
 * The two ways a signed-in person can be turned away, said as two different
 * things.
 *
 * They arrive as the same 401, which is deliberate on the server's side, and
 * conflating them here would be the second mistake: telling an operator whose
 * code was withdrawn to check the address, or telling someone who wandered onto
 * another business's queue that they have been signed out — while their session
 * was working perfectly.
 */
export function AccessNotice({ outcome, role, what }: AccessNoticeProps): JSX.Element {
  if (outcome === "not-permitted") {
    return (
      <Notice
        tone="standing"
        title={`Not your ${what}`}
        chip="!"
        action={<LinkButton href="/queues">My queues</LinkButton>}
      >
        You are still signed in — this one is simply not yours to open. An address in Qless says
        what a thing is, never who may open it. Whatever you can run is on your own list.
      </Notice>
    );
  }

  return (
    <Notice
      tone="standing"
      title="This device has been signed out"
      chip="!"
      action={<LinkButton href="/enter">Enter a code</LinkButton>}
    >
      {role === "OPERATOR"
        ? "The access code you signed in with has been replaced or withdrawn. Ask whoever runs the queue for a new one — anything you did is still on their history."
        : "This session no longer works, which happens when it is signed out from another device. Your recovery code brings your queues back."}
    </Notice>
  );
}

