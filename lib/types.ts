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
  /**
   * How the counter picks who is next. Public because a draw changes the
   * wording on every surface: nobody is ahead of anybody.
   */
  servingOrder: ServingOrder;
  /** What the people in this queue are called: customer, guest, participant. */
  personNoun: string;
  peopleNoun: string;
}

/**
 * In order is the queue as it has always been: the lowest number next. At
 * random is a draw: everyone holds a number, one is called at random, and one
 * more is drawn ahead as up next. A draw always has a fixed number of places.
 */
export type ServingOrder = "IN_ORDER" | "RANDOM";

export const DEFAULT_PERSON_NOUN = "customer";
export const DEFAULT_PEOPLE_NOUN = "customers";
export const NOUN_LIMIT = 30;

export interface Queue extends QueueSummary {
  nextNumber: number;
  /** Settable from phase 3; phase 5 is what makes it change a payload. */
  showNamesToOperators: boolean;
  /**
   * Staff work the chair the owner assigned and cannot pick another. Off,
   * they may take any free chair and leave it.
   */
  seatsFixed: boolean;
  /** When the numbering last started again. A draw counts its places from here. */
  resetAt: string | null;
  /** Set once the owner has put the queue away. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A queue with the live figures an owner reads a list by. */
export interface QueueCard extends Queue {
  /** The most recent call. Kept for the one-seat card. */
  servingNumber: number | null;
  servingCount: number;
  openSeats: number;
  waitingCount: number;
}

/** Who works a chair: an operator, the owner, or nobody. */
export interface SeatWorker {
  type: PrincipalRole;
  /** Empty for the owner. */
  operatorId?: string;
  /** The operator's display name, or the owner's. */
  name: string;
}

/**
 * One place a customer is sent to be served. A queue always has at least
 * one; a queue with one is a queue with a counter and never shows the word.
 */
export interface Seat {
  id: string;
  queueId: string;
  name: string;
  position: number;
  /** In service now. A closed chair drops out of the estimate. */
  active: boolean;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
  worker: SeatWorker | null;
}

/** What a customer surface knows about a seat. */
export interface PublicSeat {
  id: string;
  name: string;
  active: boolean;
  /** Who is at the chair, for "Kofi is ready for you". Empty when nobody is. */
  workerName: string;
}

/** One number being served and where. */
export interface ServingSlot {
  number: number;
  seatId: string;
  seatName: string;
}

/** What service has actually taken lately. */
export interface ServiceMeasure {
  minutes: number;
  sample: number;
}

/** One chair's measured service, for an owner comparing chairs. */
export interface SeatMeasure {
  seatId: string;
  seatName: string;
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
  /** Where they were called to. Null while they wait; kept afterwards. */
  seatId: string | null;
  /**
   * When a draw picked this number as up next. The one waiting entry with this
   * set is the one the counter calls next. Kept after the call.
   */
  drawnAt: string | null;
}

export interface Estimate {
  lowMinutes: number;
  highMinutes: number;
  label: string;
}

/** The public payload. Carries numbers only — never customer names. */
export interface PublicState {
  queue: QueueSummary;
  /** The most recent call. Kept for boards from before seats; `serving` is the whole picture. */
  servingNumber: number | null;
  /** Every number being served and its seat, in seat order. */
  serving: ServingSlot[];
  /** The queue's seats in order, closed ones included. */
  seats: PublicSeat[];
  /** How many seats are in service: what the estimate and the ladder divide by. */
  openSeats: number;
  waitingNumbers: number[];
  waitingCount: number;
  isFull: boolean;
  /**
   * What the capacity is measured against: the people in line when served in
   * order, every number handed out since the last reset in a draw.
   */
  placesTaken: number;
  /**
   * The number a draw has picked to be called next. Null when served in
   * order, before a draw's first call, and once nobody is left to draw.
   */
  upNextNumber: number | null;
  /** The figure the estimates were built from: measured once there is one. */
  serviceMinutes: number;
  /**
   * Indexed by people ahead, length `waitingCount + 1`. A customer works out
   * their own position from `waitingNumbers` — that is what keeps other
   * customers off the wire — then reads their wait from here rather than
   * recomputing a formula that only the server should own. Empty in a draw,
   * which quotes no wait.
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
  /** The caller's own id: the owner's, or the operator's, which is how a counter finds their chair. */
  principalId: string;
  /** What the owner has put away. Always empty for an operator. */
  archived: Queue[];
  /** What the owner asked to be called, or the name the owner gave an operator. */
  displayName: string;
}

export interface WaitingRow extends QueueEntry {
  estimate: Estimate | null;
}

export interface OperatorView {
  queue: Queue;
  /** The most recent call. Kept for the one-seat screens; every seat's occupant is in `servingList`. */
  serving: QueueEntry | null;
  /** Everyone being served, one per seat, in seat order. */
  servingList: QueueEntry[];
  /** The queue's seats in order, removed ones left out. */
  seats: Seat[];
  waiting: WaitingRow[];
  waitingCount: number;
  /** What the capacity is measured against; see PublicState.placesTaken. */
  placesTaken: number;
  /** Stood down inside the recall window, most recent first. Still callable. */
  skipped: QueueEntry[];
  /** The average of the last few real service times, and how many there were. */
  measured: ServiceMeasure;
  /** The same figure per chair, in seat order. */
  measuredBySeat: SeatMeasure[];
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
  servingOrder?: ServingOrder;
  personNoun?: string;
  peopleNoun?: string;
  /** Read only when this request creates the business. */
  ownerName?: string;
}

/**
 * A partial update: an omitted field is left alone. `maxCapacity: null` is the
 * one value that means something on its own — "no limit" — which is why it is
 * nullable rather than merely optional. The server refuses it on a draw.
 */
export interface UpdateQueueInput {
  name?: string;
  description?: string;
  averageServiceMinutes?: number;
  maxCapacity?: number | null;
  showNamesToOperators?: boolean;
  holdMinutes?: number;
  seatsFixed?: boolean;
  servingOrder?: ServingOrder;
  /** Blank puts the default back. */
  personNoun?: string;
  peopleNoun?: string;
}

export interface SeatsResponse {
  seats: Seat[];
}

/** A partial update: an omitted field is left alone. `worker: null` makes the chair nobody's. */
export interface UpdateSeatInput {
  name?: string;
  active?: boolean;
  /** 1-based. Moves the seat; the rest shift. */
  position?: number;
  worker?: { type: "OWNER" } | { type: "OPERATOR"; operatorId: string } | null;
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
  /** The chairs this person holds, at most one per queue. */
  seats: OperatorSeat[];
  createdAt: string;
  updatedAt: string;
}

export interface OperatorSeat {
  queueId: string;
  seatId: string;
  seatName: string;
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
  /** The chair they were called to, by name. Empty if never called. Resolves for a removed chair too. */
  seatName: string;
}

/** What a queue has finished with. Can carry names, so it is operator-only. */
export interface HistoryResponse {
  queue: Queue;
  entries: HistoryEntry[];
  /** The queue's chairs, so a one-chair history never shows a chair column. */
  seats: Seat[];
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

/**
 * How many calls have to happen before this customer's own, with several
 * chairs calling at once: three chairs and three people ahead is one turn.
 * The server's push ladder ranks on the same figure, so a phone never hears
 * "you're next" from one and "it's your turn" from the other a second apart.
 */
export function turnsAhead(peopleAhead: number, openSeats: number): number {
  return Math.floor(peopleAhead / Math.max(1, openSeats));
}

/**
 * In a draw there is no "close": a number waits until it is drawn, then it is
 * next, then it is called. Being the lowest number counts for nothing.
 */
export function proximityOf(entry: QueueEntry, state: PublicState, peopleAhead: number): Proximity {
  if (entry.status === "SERVING") return "current";
  if (isDraw(state.queue)) {
    return state.upNextNumber === entry.number ? "next" : "waiting";
  }
  const turns = turnsAhead(peopleAhead, state.openSeats);
  if (turns === 0) return "next";
  if (turns <= 3) return "close";
  return "waiting";
}

/**
 * Whether this queue calls people at random. Read through here rather than
 * compared inline: a server from before draws sends no servingOrder at all,
 * and that is a queue served in order.
 */
export function isDraw(summary: Pick<QueueSummary, "servingOrder">): boolean {
  return summary.servingOrder === "RANDOM";
}

/**
 * What one or several people in this queue are called, in lower case. An
 * empty or missing noun, from a server from before nouns, is the default.
 */
export function nounFor(summary: Pick<QueueSummary, "personNoun" | "peopleNoun">, count: number): string {
  return count === 1
    ? summary.personNoun || DEFAULT_PERSON_NOUN
    : summary.peopleNoun || DEFAULT_PEOPLE_NOUN;
}

/** "3 guests", "One guest": the count and the noun, ready to start a sentence. */
export function countOf(summary: Pick<QueueSummary, "personNoun" | "peopleNoun">, count: number): string {
  return count === 1 ? `One ${nounFor(summary, 1)}` : `${count} ${nounFor(summary, count)}`;
}

/** "Guest 7" for somebody with no name, or whose name is kept from this screen. */
export function labelFor(
  summary: Pick<QueueSummary, "personNoun" | "peopleNoun">,
  entry: Pick<QueueEntry, "customerName" | "number">,
): string {
  if (entry.customerName) return entry.customerName;
  const noun = nounFor(summary, 1);
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${entry.number}`;
}

/**
 * The waiting row the counter calls next: the drawn one in a draw, where it is
 * undefined until the first call draws somebody, and the head of the list
 * otherwise.
 */
export function nextInLine<T extends QueueEntry>(summary: Pick<QueueSummary, "servingOrder">, waiting: T[]): T | undefined {
  if (isDraw(summary)) return waiting.find((entry) => Boolean(entry.drawnAt));
  return waiting[0];
}

/**
 * The number that will be called next, whichever way the queue is served:
 * the drawn number in a draw, the lowest waiting number otherwise.
 */
export function nextNumberOf(state: Pick<PublicState, "queue" | "upNextNumber" | "waitingNumbers">): number | null {
  if (isDraw(state.queue)) return state.upNextNumber ?? null;
  return state.waitingNumbers[0] ?? null;
}

/** The chair a called customer was sent to, by name, or null on a one-chair queue or while waiting. */
export function seatFor(state: PublicState, entry: QueueEntry | null): PublicSeat | null {
  if (!entry || !entry.seatId || state.seats.length <= 1) return null;
  return state.seats.find((seat) => seat.id === entry.seatId) ?? null;
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
  // A draw has no position and quotes no wait, which is what the server says
  // too; a number below yours is not ahead of you.
  if (isDraw(state.queue)) {
    return { state, entry, peopleAhead: 0, estimate: null, joinEstimate: null };
  }

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
      return !state.serving.some((slot) => slot.number === entry.number);
    default:
      // An ended entry stays ended; a customer rejoining goes through join.
      return false;
  }
}

