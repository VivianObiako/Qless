import type {
  CreateOperatorInput,
  CreateQueueInput,
  CreateQueueResponse,
  CustomerView,
  EntryAction,
  HistoryResponse,
  JoinResponse,
  MyQueuesResponse,
  OperatorResponse,
  OperatorsResponse,
  OperatorView,
  Presence,
  QueueAction,
  RedeemResponse,
  UpdateOperatorInput,
  UpdateQueueInput,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/**
 * Every failure the UI can act on arrives as one of these. `code` drives which
 * empty state to render; `message` is already written for the reader, so it can
 * be shown verbatim.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

interface ErrorBody {
  error: string;
  message: string;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  customerToken?: string | null;
  /** Identifies the principal running queues — an owner, later an operator. */
  sessionToken?: string | null;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.customerToken) headers.set("X-Customer-Token", options.customerToken);
  if (options.sessionToken) headers.set("Authorization", `Bearer ${options.sessionToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError("network_error", "We couldn't reach the queue. Check your connection.", 0);
  }

  if (!response.ok) {
    const body = await safeJson<ErrorBody>(response);
    throw new ApiError(
      body?.error ?? "unknown_error",
      body?.message ?? "Something went wrong.",
      response.status,
    );
  }

  // An acknowledgement answers 204 and has no body to parse. Callers of those
  // endpoints type T as void and never read the result.
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * The realtime endpoint for one queue.
 *
 * A browser cannot set an Authorization header on a WebSocket handshake, so an
 * operator's token travels in the query string — the same place the dashboard
 * link already carries it. Without it the socket is a public one and the server
 * will only ever send it frames with no names in them.
 */
export function queueSocketUrl(key: string, ownerToken?: string | null): string {
  const base = API_URL.replace(/^http/, "ws");
  const url = `${base}/api/queues/${encodeURIComponent(key)}/ws`;
  return ownerToken ? `${url}?k=${encodeURIComponent(ownerToken)}` : url;
}

/**
 * Creating a queue as an existing owner adds it to that business. Without a
 * session it creates the business too, and the response carries the recovery
 * code once.
 */
export function createQueue(
  input: CreateQueueInput,
  sessionToken?: string | null,
): Promise<CreateQueueResponse> {
  return request<CreateQueueResponse>("/api/queues", {
    method: "POST",
    body: input,
    sessionToken,
  });
}

/**
 * Exchanges a typed code for a session. The server decides the role from which
 * code matched — the client never says who it thinks it is.
 */
export function redeemAccessCode(code: string): Promise<RedeemResponse> {
  return request<RedeemResponse>("/api/access/redeem", { method: "POST", body: { code } });
}

/**
 * Confirms the owner has the replacement code. Until this lands the redeemed
 * code still works, so this is the request that makes recovery single-use.
 */
/**
 * Signs out every other device holding this owner's session and keeps this
 * one. Owner only, and never part of recovery: replacing a phone should not
 * sign the counter tablet out unless the owner asks for exactly that.
 */
export function revokeOtherSessions(sessionToken: string): Promise<void> {
  return request<void>("/api/sessions/revoke-others", { method: "POST", sessionToken });
}

export function acknowledgeRecoveryCode(sessionToken: string): Promise<void> {
  return request<void>("/api/access/recovery-code/acknowledge", {
    method: "POST",
    sessionToken,
  });
}

/** Who this session belongs to, and what it can open. */
export function getMyQueues(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<MyQueuesResponse> {
  return request<MyQueuesResponse>("/api/me/queues", { sessionToken, signal });
}

export function getQueue(
  slug: string,
  customerToken: string | null,
  signal?: AbortSignal,
): Promise<CustomerView> {
  return request<CustomerView>(`/api/queues/${encodeURIComponent(slug)}`, { customerToken, signal });
}

export function joinQueue(
  slug: string,
  name: string,
  customerToken: string | null,
): Promise<JoinResponse> {
  return request<JoinResponse>(`/api/queues/${encodeURIComponent(slug)}/join`, {
    method: "POST",
    body: { name },
    customerToken,
  });
}

/** Tell the counter where you are: on the way, here, or needing a moment. */
export function setPresence(
  slug: string,
  presence: Presence,
  customerToken: string,
): Promise<CustomerView> {
  return request<CustomerView>(`/api/queues/${encodeURIComponent(slug)}/presence`, {
    method: "POST",
    body: { presence },
    customerToken,
  });
}

export function leaveQueue(slug: string, customerToken: string): Promise<CustomerView> {
  return request<CustomerView>(`/api/queues/${encodeURIComponent(slug)}/leave`, {
    method: "POST",
    customerToken,
  });
}

export function getOperatorView(
  queueId: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<OperatorView> {
  return request<OperatorView>(`/api/queues/${encodeURIComponent(queueId)}/entries`, {
    sessionToken,
    signal,
  });
}

export function serveNext(queueId: string, sessionToken: string): Promise<OperatorView> {
  return request<OperatorView>(`/api/queues/${encodeURIComponent(queueId)}/next`, {
    method: "POST",
    sessionToken,
  });
}

/**
 * Serve, attend or skip one named customer. Every one of these answers with the
 * refreshed dashboard, so the screen updates from a single round trip instead
 * of waiting for its own broadcast to come back.
 */
export function actOnEntry(
  queueId: string,
  entryId: string,
  action: EntryAction,
  sessionToken: string,
): Promise<OperatorView> {
  return request<OperatorView>(
    `/api/queues/${encodeURIComponent(queueId)}/entries/${encodeURIComponent(entryId)}/${action}`,
    { method: "POST", sessionToken },
  );
}

/** Pause, resume, close or reset the queue. */
export function actOnQueue(
  queueId: string,
  action: QueueAction,
  sessionToken: string,
): Promise<OperatorView> {
  return request<OperatorView>(`/api/queues/${encodeURIComponent(queueId)}/${action}`, {
    method: "POST",
    sessionToken,
  });
}

export function updateQueue(
  queueId: string,
  input: UpdateQueueInput,
  sessionToken: string,
): Promise<OperatorView> {
  return request<OperatorView>(`/api/queues/${encodeURIComponent(queueId)}`, {
    method: "PATCH",
    body: input,
    sessionToken,
  });
}

export function getHistory(
  queueId: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<HistoryResponse> {
  return request<HistoryResponse>(`/api/queues/${encodeURIComponent(queueId)}/history`, {
    sessionToken,
    signal,
  });
}

/**
 * The roster. Every one of these is owner-only on the server; the screens below
 * hide them from an operator as a courtesy, not as the check.
 */
export function getOperators(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<OperatorsResponse> {
  return request<OperatorsResponse>("/api/operators", { sessionToken, signal });
}

export function createOperator(
  input: CreateOperatorInput,
  sessionToken: string,
): Promise<OperatorResponse> {
  return request<OperatorResponse>("/api/operators", {
    method: "POST",
    body: input,
    sessionToken,
  });
}

export function updateOperator(
  operatorId: string,
  input: UpdateOperatorInput,
  sessionToken: string,
): Promise<OperatorResponse> {
  return request<OperatorResponse>(`/api/operators/${encodeURIComponent(operatorId)}`, {
    method: "PATCH",
    body: input,
    sessionToken,
  });
}

export function regenerateOperatorCode(
  operatorId: string,
  sessionToken: string,
): Promise<OperatorResponse> {
  return request<OperatorResponse>(`/api/operators/${encodeURIComponent(operatorId)}/code`, {
    method: "POST",
    sessionToken,
  });
}

export function revokeOperator(
  operatorId: string,
  sessionToken: string,
): Promise<OperatorResponse> {
  return request<OperatorResponse>(`/api/operators/${encodeURIComponent(operatorId)}/revoke`, {
    method: "POST",
    sessionToken,
  });
}

