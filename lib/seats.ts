import type { OperatorView, QueueEntry, Seat } from "./types";

/**
 * What a chair is doing, derived from the seat and whoever is on it.
 *
 * closed    — taken out of service; out of the estimate and off the wall
 * unstaffed — open, nobody works it; counts in the estimate, never a target
 * ready     — open, somebody works it, nobody on it: where the next call lands
 * called    — somebody was called here and has not been served yet
 * serving   — service has begun
 */
export type ChairState = "closed" | "unstaffed" | "ready" | "called" | "serving";

export interface Chair {
  seat: Seat;
  /** The person called to this chair, if any. */
  entry: QueueEntry | null;
  state: ChairState;
}

function stateOf(seat: Seat, entry: QueueEntry | null): ChairState {
  if (entry) return entry.servedAt ? "serving" : "called";
  if (!seat.active) return "closed";
  if (!seat.worker) return "unstaffed";
  return "ready";
}

/** Every seat in order with the person on it, from one dashboard payload. */
export function chairsOf(view: OperatorView): Chair[] {
  const byId = new Map(view.servingList.map((entry) => [entry.seatId, entry]));
  return view.seats.map((seat) => {
    const entry = byId.get(seat.id) ?? null;
    return { seat, entry, state: stateOf(seat, entry) };
  });
}

/**
 * Chairs a call can land on: open, worked by somebody, nobody on them. An
 * open chair with nobody at it is deliberately not one — that is the rule
 * that keeps a customer from being sent to an empty chair.
 */
export function readyChairs(chairs: Chair[]): Chair[] {
  return chairs.filter((chair) => chair.state === "ready");
}

/** Whether this seat is the one the signed-in person works. */
export function isMine(seat: Seat, isOwner: boolean, principalId: string | null): boolean {
  if (!seat.worker) return false;
  if (isOwner) return seat.worker.type === "OWNER";
  return seat.worker.type === "OPERATOR" && seat.worker.operatorId === principalId;
}

export function myChair(chairs: Chair[], isOwner: boolean, principalId: string | null): Chair | null {
  return chairs.find((chair) => isMine(chair.seat, isOwner, principalId)) ?? null;
}

/** Who works a chair, as the tile says it. */
export function workerName(seat: Seat): string {
  if (!seat.worker) return "Nobody at it";
  return seat.worker.name || (seat.worker.type === "OWNER" ? "Owner" : "Operator");
}

/** Which chair this device has open on the counter, per queue. */
export function openSeatKey(queueId: string): string {
  return `qless.seat.${queueId}`;
}

/** Whether this device keeps the sidebar as an icon rail. */
export const SIDEBAR_KEY = "qless.sidebar";
