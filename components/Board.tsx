import type { JSX } from "react";
import { MonoLabel } from "./Label";
import { Numeral } from "./Numeral";
import { cn } from "@/lib/utils";

export type BoardRowKind = "serving" | "next" | "you" | "waiting";

export interface BoardRow {
  /** A number, or a compressed span such as "21 – 24". */
  label: string;
  status: string;
  kind: BoardRowKind;
}

const rowClasses: Record<BoardRowKind, string> = {
  serving: "bg-board-serving-bg text-board-serving-fg",
  next: "bg-board-row",
  // Full inversion. The strongest element in the list, so a customer finds
  // themselves without reading.
  you: "bg-board-hi-bg text-board-hi-fg",
  waiting: "bg-board-row",
};

const numeralClasses: Record<BoardRowKind, string> = {
  serving: "text-board-serving-fg",
  next: "text-dim",
  you: "text-board-hi-fg",
  waiting: "text-faint",
};

const statusClasses: Record<BoardRowKind, string> = {
  serving: "text-board-serving-fg",
  next: "text-muted",
  you: "text-board-hi-fg",
  waiting: "text-muted",
};

/**
 * The queue as seen from the customer's phone. Numbers only — never names.
 * The 1px gaps let the container colour through as hairlines, so there are no
 * borders to double up at the rounded corners.
 */
export function Board({ rows }: { rows: BoardRow[] }): JSX.Element {
  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] bg-shell-line">
      {/* Dim rather than muted: the header is the one strip that sits on
          shell-mid, where muted drops under 4.5:1 on the inverted surface. */}
      <div className="flex items-center justify-between bg-shell-mid px-4 py-2.5">
        <MonoLabel size={10} tone="dim">
          Board
        </MonoLabel>
        <MonoLabel size={10} tone="dim">
          Status
        </MonoLabel>
      </div>

      <div className="flex flex-col gap-px">
        {rows.map((row, index) => (
          <div
            key={`${row.kind}-${row.label}`}
            // Staggered so the board reads as settling into order, the way it
            // does while the queue is loading.
            style={{ animationDelay: `${index * 45}ms` }}
            className={cn(
              "flex animate-row-in items-center justify-between px-4 py-3.5",
              "transition-colors duration-300 motion-reduce:transition-none",
              rowClasses[row.kind],
            )}
          >
            <Numeral
              value={row.label}
              scale="board"
              animateOnChange={false}
              className={numeralClasses[row.kind]}
            />
            <MonoLabel
              size={10}
              tone="inherit"
              weight={row.kind === "you" ? 600 : 400}
              className={statusClasses[row.kind]}
            >
              {row.status}
            </MonoLabel>
          </div>
        ))}
      </div>
    </div>
  );
}

