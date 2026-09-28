"use client";

import type { JSX } from "react";
import { ChevronDown } from "lucide-react";
import { controlClasses } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { useDisclosure } from "@/hooks/useDisclosure";
import { isMine, type Chair } from "@/lib/seats";
import { cn } from "@/lib/utils";
import { nameFor } from "./Counter";

interface SeatPickerProps {
  chairs: Chair[];
  /** What one person in this queue is called, for someone with no name shown. */
  person: string;
  isOwner: boolean;
  principalId: string | null;
  seatsFixed: boolean;
  pending: boolean;
  onTake: (seatId: string) => void;
  onLeave: (seatId: string) => void;
}

/**
 * Which chair you are at. Staff pick from the free chairs only — nobody's,
 * and nobody on it — and never bump anyone; the owner may take any open
 * chair, and is told when it was somebody's. Where the owner has fixed the
 * chairs, staff see where they are and nothing to pick.
 *
 * It is a soft lock: whoever picks a chair last has it, and the other device
 * is moved off on its next frame.
 */
export function SeatPicker({
  chairs,
  person,
  isOwner,
  principalId,
  seatsFixed,
  pending,
  onTake,
  onLeave,
}: SeatPickerProps): JSX.Element {
  const { open, setOpen, toggle, containerRef, triggerRef, panelId } = useDisclosure();
  const mine = chairs.find((chair) => isMine(chair.seat, isOwner, principalId)) ?? null;

  if (!isOwner && seatsFixed) {
    return (
      <p className="text-[13px] text-dim">
        {mine ? `You're at ${mine.seat.name}` : "Ask the owner for a chair"}
        <span className="text-muted"> · chairs are fixed here</span>
      </p>
    );
  }

  const label = mine ? `You're at ${mine.seat.name}` : isOwner ? "Every chair" : "Pick a chair";

  function choose(seatId: string): void {
    setOpen(false);
    onTake(seatId);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={pending}
        onClick={toggle}
        className={cn(controlClasses("ghost", "md"), "disabled:opacity-60")}
      >
        {label}
        <Icon icon={ChevronDown} size={14} className="text-muted" />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-20 mt-1.5 w-[300px] rounded-[12px] border border-shell-line bg-shell-soft p-1.5 shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_12px_32px_rgb(0_0_0_/_0.10)]"
      >
        <p className="px-2.5 pb-0.5 pt-1.5 text-[14px] font-medium text-strong">Which seat are you at?</p>
        <p className="px-2.5 pb-2 text-[12.5px] leading-[1.5] text-muted">
          {isOwner
            ? "You see the whole floor. Pick a chair to run one yourself."
            : "The next person you call comes to it. Change it when you move."}
        </p>

        <ul>
          {chairs.map((chair) => {
            const { seat, entry, state } = chair;
            const itsMine = mine?.seat.id === seat.id;
            const status = itsMine
              ? "You"
              : !seat.active
                ? "Closed"
                : seat.worker
                  ? `${seat.worker.name || "The owner"} is here`
                  : entry
                    ? `${nameFor(entry, person)} is on it`
                    : "Free";
            // Staff: free means nobody's and nobody on it. The owner: any
            // open chair, including one they are about to take from somebody.
            const pickable = !itsMine && seat.active && (isOwner || state === "unstaffed");
            return (
              <li key={seat.id}>
                <button
                  type="button"
                  disabled={!pickable}
                  aria-current={itsMine ? "true" : undefined}
                  onClick={() => choose(seat.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-[13.5px] transition-colors pointer-coarse:min-h-11",
                    pickable ? "text-strong hover:bg-shell-mid" : "cursor-default text-dim",
                    itsMine && "bg-shell-mid",
                  )}
                >
                  <span className="font-medium">{seat.name}</span>
                  <span className={cn("text-[12.5px]", itsMine ? "text-strong" : "text-muted")}>{status}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {mine && (
          <>
            <div className="my-1.5 h-px bg-shell-line" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLeave(mine.seat.id);
              }}
              className="flex w-full items-center rounded-[8px] px-2.5 py-2 text-left text-[13.5px] text-strong transition-colors hover:bg-shell-mid pointer-coarse:min-h-11"
            >
              {isOwner ? "Show every chair" : "Leave your chair"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
