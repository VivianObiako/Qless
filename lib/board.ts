import type { BoardRow } from "@/components/Board";

interface BoardInput {
  servingNumber: number | null;
  waitingNumbers: number[];
  myNumber: number;
  /** State 03 collapses the board to the counter plus "you — next". */
  collapsed?: boolean;
}

const MAX_TRAILING_ROWS = 1;

/**
 * Turns the public queue state into the rows the customer sees.
 *
 * The board is a summary, not a full list: whoever is at the counter, whoever
 * is called next, any run of people in between compressed into a single span,
 * the customer themselves, and a hint that others follow. Numbers only — the
 * public payload carries no names, and neither does this.
 */
export function deriveBoardRows({
  servingNumber,
  waitingNumbers,
  myNumber,
  collapsed = false,
}: BoardInput): BoardRow[] {
  const rows: BoardRow[] = [];

  if (servingNumber !== null) {
    rows.push({ label: String(servingNumber), status: "At the counter", kind: "serving" });
  }

  if (collapsed) {
    rows.push({ label: String(myNumber), status: "You — next", kind: "you" });
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

