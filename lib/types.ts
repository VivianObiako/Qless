/**
 * Mirrors the Go DTOs in api/internal/api. Kept hand-written and small so the
 * contract is readable in one screen from either side.
 */

export type QueueStatus = "OPEN" | "PAUSED" | "CLOSED";

export type EntryStatus =
  | "WAITING"
  | "SERVING"
  | "ATTENDED"
  | "SKIPPED"
  | "LEFT"
  | "CLEARED";

export interface QueueSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: QueueStatus;
  averageServiceMinutes: number;
  maxCapacity: number | null;
  /**
   * How long a called customer's place is held: the counter suggests a skip
   * after it, a skipped number can be recalled within it, and the pass
   * promises it. Zero means no hold at all.
   */
  holdMinutes: number;
  /** Shown while the queue is paused. Empty otherwise. */
  pauseNote: string;
}

export interface Queue extends QueueSummary {
  nextNumber: number;
  /** Settable from phase 3; phase 5 is what makes it change a payload. */
  showNamesToOperators: boolean;
  /** Set once the owner has put the queue away. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A queue with the two live figures an owner reads a list by. */
export interface QueueCard extends Queue {
  servingNumber: number | null;
  waitingCount: number;
}

/** What service has actually taken lately. */
export interface ServiceMeasure {
  minutes: number;
  sample: number;
}

/** How many real service times the estimate needs before it uses them. */
export const MEASURE_SAMPLE = 5;

/** What a customer has told the counter about where they are. */
export type Presence = "ON_THE_WAY" | "HERE" | "HOLD";

export interface QueueEntry {
  id: string;
  queueId: string;
  number: number;
  customerName: string;
  status: EntryStatus;
  joinedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  /**
   * When service began, as distinct from `startedAt`, which is the call. Null
   * until inferred or tapped; the gap is the customer walking back.
   */
  servedAt: string | null;
  /** Null until the customer says something. Never on a public surface. */
  presence: Presence | null;
  presenceAt: string | null;
  /** Added at the counter by staff; no phone can recover this entry. */
  walkIn: boolean;
}

export interface Estimate {
  lowMinutes: number;
  highMinutes: number;
  label: string;
}

/** The public payload. Carries numbers only — never customer names. */
export interface PublicState {
  queue: QueueSummary;
  servingNumber: number | null;
  waitingNumbers: number[];
  waitingCount: number;
  isFull: boolean;
  /** The figure the estimates were built from: measured once there is one. */
  serviceMinutes: number;
  /**
   * Indexed by people ahead, length `waitingCount + 1`. A customer works out
   * their own position from `waitingNumbers` — that is what keeps other
   * customers off the wire — then reads their wait from here rather than
   * recomputing a formula that only the server should own.
   */
  estimates: (Estimate | null)[];
}

export interface CustomerView {
  state: PublicState;
  entry: QueueEntry | null;
  peopleAhead: number;
  estimate: Estimate | null;
  joinEstimate: Estimate | null;
}

export interface JoinResponse extends CustomerView {
  customerToken: string;
  alreadyJoined: boolean;
}

/** Who a session token turns out to belong to. The server decides this; the
 *  client never claims it. */
export type PrincipalRole = "OWNER" | "OPERATOR";

export interface CreateQueueResponse {
  queue: Queue;
  ownerToken: string;
  /**
   * Present only when this request created the business. An owner adding a
   * second queue already has a code, and it cannot be shown twice.
   */
  recoveryCode?: string;
}

export interface RedeemResponse {
  role: PrincipalRole;
  token: string;
  queues: QueueCard[];
  /**
   * The replacement code, returned once. It does not become the live one until
   * the client acknowledges it, which is what stops a lost response from
   * locking an owner out of their own business.
   */
  recoveryCode?: string;
}

export interface MyQueuesResponse {
  role: PrincipalRole;
  queues: QueueCard[];
  /** What the owner has put away. Always empty for an operator. */
  archived: Queue[];
  /** What the owner asked to be called. Empty for an operator. */
  displayName: string;
}

export interface WaitingRow extends QueueEntry {
  estimate: Estimate | null;
}

export interface OperatorView {
  queue: Queue;
  serving: QueueEntry | null;
  waiting: WaitingRow[];
  waitingCount: number;
  /** Stood down inside the recall window, most recent first. Still callable. */
  skipped: QueueEntry[];
  /** The average of the last few real service times, and how many there were. */
  measured: ServiceMeasure;
  /** How long people have been taking to turn up once called. */
  arrival: ServiceMeasure;
  /** When anything last happened here. Null for a queue nobody has joined. */
  lastActivityAt: string | null;
  /**
   * Whether this payload carries customer names. False for staff on a queue
   * that keeps names to the owner — the entries arrive with `customerName`
   * blank, and the screen shows a queue of numbers on purpose.
   */
  showsNames: boolean;
}

export interface CreateQueueInput {
  name: string;
  description: string;
  averageServiceMinutes: number;
  maxCapacity: number | null;
  /** Read only when this request creates the business. */
  ownerName?: string;
}

/**
 * A partial update: an omitted field is left alone. `maxCapacity: null` is the
 * one value that means something on its own — "no limit" — which is why it is
 * nullable rather than merely optional.
 */
export interface UpdateQueueInput {
  name?: string;
  description?: string;
  averageServiceMinutes?: number;
  maxCapacity?: number | null;
  showNamesToOperators?: boolean;
  holdMinutes?: number;
}

export type OperatorStatus = "ACTIVE" | "REVOKED";

/**
 * A named member of staff. Revoked operators stay on the roster so the entries
 * they handled keep resolving to a name.
 */
export interface Operator {
  id: string;
  displayName: string;
  status: OperatorStatus;
  queueIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OperatorsResponse {
  operators: Operator[];
}

/** The access code is present only on the two requests that mint one. */
export interface OperatorResponse {
  operator: Operator;
  accessCode?: string;
}

export interface CreateOperatorInput {
  displayName: string;
  queueIds: string[];
}

export interface UpdateOperatorInput {
  displayName?: string;
  queueIds?: string[];
}

/** Who moved an entry. Null when the customer ended it themselves. */
export interface ActedBy {
  type: PrincipalRole;
  operatorName?: string;
}

export interface HistoryEntry extends QueueEntry {
  actedBy: ActedBy | null;
}

/** What a queue has finished with. Can carry names, so it is operator-only. */
export interface HistoryResponse {
  queue: Queue;
  entries: HistoryEntry[];
  showsNames: boolean;
  /** The owner's name, for entries they handled. Empty when they have none. */
  ownerName: string;
}

/** The queue lifecycle actions that share one endpoint shape. */
export type QueueAction = "pause" | "resume" | "close" | "reset" | "archive" | "unarchive";

/** The per-entry actions that share one endpoint shape. */
export type EntryAction = "serve" | "attend" | "skip" | "start";

/**
 * How close a customer is to being served. The customer page uses this to pick
 * its colour and its headline; it is derived once here so the two can never
 * disagree.
 */
export type Proximity = "waiting" | "close" | "next" | "current";

export function proximityOf(entry: QueueEntry, peopleAhead: number): Proximity {
  if (entry.status === "SERVING") return "current";
  if (peopleAhead === 0) return "next";
  if (peopleAhead <= 3) return "close";
  return "waiting";
}

/** Realtime. Every event carries a full snapshot, so the type is what changed,
 *  not what to apply. */
export type QueueEventType =
  | "QUEUE_UPDATED"
  | "CUSTOMER_JOINED"
  | "CUSTOMER_LEFT"
  | "CUSTOMER_SKIPPED"
  | "CUSTOMER_SERVED"
  | "CUSTOMER_ATTENDED"
  | "QUEUE_PAUSED"
  | "QUEUE_RESUMED"
  | "QUEUE_CLOSED"
  | "QUEUE_RESET"
  | "CUSTOMER_PRESENCE"
  | "CUSTOMER_STARTED";

export interface PublicEvent {
  type: QueueEventType;
  at: string;
  state: PublicState;
}

export interface OperatorEvent {
  type: QueueEventType;
  at: string;
  view: OperatorView;
}

/**
 * Rebuilds the customer's view from a public frame plus the entry we already
 * hold. Position is counted here rather than sent, because sending it would
 * mean the server addressing a payload to one customer — and the public frame
 * goes to everyone.
 */
export function customerViewFrom(state: PublicState, entry: QueueEntry | null): CustomerView {
  const peopleAhead =
    entry && entry.status === "WAITING"
      ? state.waitingNumbers.filter((number) => number < entry.number).length
      : 0;

  return {
    state,
    entry,
    peopleAhead,
    estimate: entry?.status === "WAITING" ? (state.estimates[peopleAhead] ?? null) : null,
    joinEstimate: state.estimates[state.waitingCount] ?? null,
  };
}

/**
 * True when our copy of the entry can no longer be reconciled with the public
 * state — the customer was served, skipped or cleared, and only `/me` can say
 * which. Everything else the browser can work out for itself.
 */
export function entryIsStale(state: PublicState, entry: QueueEntry | null): boolean {
  if (!entry) return false;

  switch (entry.status) {
    case "WAITING":
      return !state.waitingNumbers.includes(entry.number);
    case "SERVING":
      return state.servingNumber !== entry.number;
    default:
      // An ended entry stays ended; a customer rejoining goes through join.
      return false;
  }
}

