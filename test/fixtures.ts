import type { OperatorView, QueueEntry, Seat, SeatWorker } from "@/lib/types";

export function seat(overrides: Partial<Seat> = {}): Seat {
  return {
    id: "seat-1",
    queueId: "queue-1",
    name: "Chair 1",
    position: 0,
    active: true,
    removedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    worker: null,
    ...overrides,
  };
}

export const owner: SeatWorker = { type: "OWNER", name: "Ada" };

export function operator(operatorId: string, name = "Tunde"): SeatWorker {
  return { type: "OPERATOR", operatorId, name };
}

export function entry(overrides: Partial<QueueEntry> = {}): QueueEntry {
  return {
    id: "entry-1",
    queueId: "queue-1",
    number: 1,
    customerName: "Bisi",
    status: "SERVING",
    joinedAt: "2026-01-01T09:00:00Z",
    startedAt: "2026-01-01T09:05:00Z",
    completedAt: null,
    servedAt: null,
    presence: null,
    presenceAt: null,
    walkIn: false,
    seatId: null,
    drawnAt: null,
    ...overrides,
  };
}

/**
 * chairsOf reads only the seats and who is on them. The rest of the dashboard
 * payload is irrelevant to it, so the fixture does not invent it.
 */
export function operatorView(seats: Seat[], servingList: QueueEntry[] = []): OperatorView {
  return { seats, servingList } as unknown as OperatorView;
}
