import type { CallPhrase, QueueSummary } from "@/lib/types";

/**
 * Every form of "being called" the room's screens use, written out by hand
 * for each choice. The phrase appears as a heading ("Now presenting"), as a
 * state ("presenting"), in a sentence read aloud and in the note after a
 * turn, and no single word bends into all of those.
 */
export interface CallWording {
  /** The owner's name for the choice, in Settings. */
  label: string;
  /** What Settings says the choice is for. */
  suits: string;
  /** The heading on the wall, the join page and the pass: "Now serving". */
  now: string;
  /** Under a chair on the wall while somebody is at it: "being served". */
  inUse: string;
  /** The status beside the number being called on a pass's board. */
  boardStatus: string;
  /** Read aloud by the wall when nobody has been called. */
  nobodyYet: string;
  /** The notice on the join page after someone's turn is over. */
  doneTitle: string;
  doneBody: string;
}

export const CALL_PHRASES: Record<CallPhrase, CallWording> = {
  SERVING: {
    label: "Serving",
    suits: "shops and counters",
    now: "Now serving",
    inUse: "being served",
    boardStatus: "At the counter",
    nobodyYet: "Nobody is being served yet.",
    doneTitle: "You've been served",
    doneBody: "Thanks for waiting. Take another number if you need anything else.",
  },
  PRESENTING: {
    label: "Presenting",
    suits: "hackathons and pitch nights",
    now: "Now presenting",
    inUse: "presenting",
    boardStatus: "Presenting",
    nobodyYet: "Nobody is presenting yet.",
    doneTitle: "Thanks for presenting",
    doneBody: "That's your turn done. Take another number only if you've been asked to go again.",
  },
  SEEING: {
    label: "Seeing",
    suits: "clinics and advisors",
    now: "Now seeing",
    inUse: "being seen",
    boardStatus: "Being seen",
    nobodyYet: "Nobody is being seen yet.",
    doneTitle: "You've been seen",
    doneBody: "Thanks for waiting. Take another number if you need to be seen again.",
  },
  UP: {
    label: "Up",
    suits: "anything else",
    now: "Now up",
    inUse: "on now",
    boardStatus: "On now",
    nobodyYet: "Nobody is up yet.",
    doneTitle: "You're all done",
    doneBody: "Thanks for waiting. Take another number if you need another turn.",
  },
};

export const CALL_PHRASE_ORDER: CallPhrase[] = ["SERVING", "PRESENTING", "SEEING", "UP"];

/**
 * The wording for a queue. A server from before the setting sends no phrase,
 * and an unknown one is treated the same way: that queue says "serving".
 */
export function wordingFor(summary: Pick<QueueSummary, "callPhrase">): CallWording {
  return CALL_PHRASES[summary.callPhrase] ?? CALL_PHRASES.SERVING;
}
