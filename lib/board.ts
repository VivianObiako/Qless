import type { BoardRow } from "@/components/Board";
import type { ServingSlot } from "@/lib/types";

interface BoardInput {
  /** Everyone being served and where, in seat order. */
  serving: ServingSlot[];
  /** How many seats the queue has: with one, the chair is "the counter" and is not named. */
  seatCount: number;
  waitingNumbers: number[];
  myNumber: number;
  /** State 03 collapses the board to the counter plus "you — next". */
  collapsed?: boolean;
  /**
   * A draw: nobody is ahead of anybody, so the board shows the drawn number
   * and how many others are still in it, and never a run of numbers.
   */
  draw?: { upNextNumber: number | null };
}

const MAX_TRAILING_ROWS = 1;

/**
 * Turns the public queue state into the rows the customer sees.
 *
 * The board is a summary, not a full list: whoever is being served — one row
 * per chair, named when there is more than one — whoever is called next, any
 * run of people in between compressed into a single span, the customer
 * themselves, and a hint that others follow. Numbers only — the public
 * payload carries no names, and neither does this.
 */
export function deriveBoardRows({
  serving,
  seatCount,
  waitingNumbers,
  myNumber,
  collapsed = false,
  draw,
}: BoardInput): BoardRow[] {
  const rows: BoardRow[] = [];

  for (const slot of serving) {
    rows.push({
      label: String(slot.number),
      status: seatCount > 1 ? slot.seatName : "At the counter",
      kind: "serving",
    });
  }

  if (collapsed) {
    rows.push({ label: String(myNumber), status: "You — next", kind: "you" });
    return rows;
  }

  if (draw) {
    const drawn = draw.upNextNumber;
    if (drawn !== null && drawn !== myNumber) {
      rows.push({ label: String(drawn), status: "Up next", kind: "next" });
    }
    rows.push({ label: String(myNumber), status: "You", kind: "you" });

    const others = waitingNumbers.filter((number) => number !== myNumber && number !== drawn).length;
    if (others > 0) {
      rows.push({ label: `+${others}`, status: "Still in the draw", kind: "waiting" });
    }
    return rows;
  }

  const myIndex = waitingNumbers.indexOf(myNumber);
  const ahead = myIndex === -1 ? [] : waitingNumbers.slice(0, myIndex);
  const behind = myIndex === -1 ? [] : waitingNumbers.slice(myIndex + 1);

  if (ahead.length > 0) {
    rows.push({ label: String(ahead[0]), status: "Called next", kind: "next" });

    const between = ahead.slice(1);
    if (between.length === 1) {
      rows.push({ label: String(between[0]), status: "Waiting", kind: "waiting" });
    } else if (between.length > 1) {
      rows.push({
        label: `${between[0]} – ${between[between.length - 1]}`,
        status: "Waiting",
        kind: "waiting",
      });
    }
  }

  rows.push({ label: String(myNumber), status: "You", kind: "you" });

  for (const number of behind.slice(0, MAX_TRAILING_ROWS)) {
    rows.push({ label: String(number), status: "Waiting", kind: "waiting" });
  }

  return rows;
}
