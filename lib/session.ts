/**
 * Browser-held identity. Qless has no accounts, so what this file holds is the
 * whole of "who is this": a customer token per queue, and one session token for
 * whoever is running queues in this browser. Both are opaque and are only ever
 * sent back to the API that issued them.
 *
 * The session token is deliberately *not* per queue. It identifies a principal —
 * an owner, later an operator — and the server answers which queues that
 * principal can open. That is what makes a "my queues" list possible at all,
 * and it is why nothing here enumerates storage keys looking for queues.
 *
 * localStorage is an external store, so writes notify subscribers and React
 * reads it through useSyncExternalStore rather than copying it into state.
 */

const CUSTOMER_TOKEN_PREFIX = "qless.customer.";
const JOINED_AHEAD_PREFIX = "qless.joinedAhead.";
const OWNER_TOKEN_PREFIX = "qless.owner.";

const SESSION_TOKEN_KEY = "qless.session.token";
const SESSION_ROLE_KEY = "qless.session.role";

export type SessionRole = "OWNER" | "OPERATOR";

export function customerTokenKey(slug: string): string {
  return CUSTOMER_TOKEN_PREFIX + slug;
}

export function joinedAheadKey(slug: string): string {
  return JOINED_AHEAD_PREFIX + slug;
}

/**
 * Where this browser kept a dashboard's token before sessions existed. Still
 * read, never written: a browser that has only ever opened a bookmarked
 * dashboard link keeps working, and the first visit after this change promotes
 * that token into a session.
 */
export function ownerTokenKey(queueId: string): string {
  return OWNER_TOKEN_PREFIX + queueId;
}

export function sessionTokenKey(): string {
  return SESSION_TOKEN_KEY;
}

export function sessionRoleKey(): string {
  return SESSION_ROLE_KEY;
}

const listeners = new Set<() => void>();

/** Subscribe to session changes in this tab and in others. */
export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function readSession(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private browsing modes can throw on access rather than returning null.
    return null;
  }
}

export function writeSession(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A customer with storage disabled simply loses recovery across reloads;
    // the queue itself still works for the life of the page.
  }
  notify();
}

function removeSession(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do; see writeSession().
  }
  notify();
}

export function getCustomerToken(slug: string): string | null {
  return readSession(customerTokenKey(slug));
}

export function setCustomerToken(slug: string, token: string): void {
  writeSession(customerTokenKey(slug), token);
}

/**
 * How many people were ahead at the moment of joining. Kept client-side purely
 * to give the progress bar a start point; nothing depends on it being correct.
 */
export function setJoinedAhead(slug: string, peopleAhead: number): void {
  writeSession(joinedAheadKey(slug), String(peopleAhead));
}

export function clearJoinedAhead(slug: string): void {
  removeSession(joinedAheadKey(slug));
}

export function getOwnerToken(queueId: string): string | null {
  return readSession(ownerTokenKey(queueId));
}

export function getSessionToken(): string | null {
  return readSession(SESSION_TOKEN_KEY);
}

export function getSessionRole(): SessionRole | null {
  const stored = readSession(SESSION_ROLE_KEY);
  return stored === "OWNER" || stored === "OPERATOR" ? stored : null;
}

/**
 * Stores the session and reports whether it survived the write.
 *
 * The return value is not ceremony. A browser in private mode can accept a
 * write and lose it, and one caller — the dashboard stripping its own `?k=`
 * from the URL — is about to throw away the only other copy of this token. It
 * needs to know rather than assume.
 */
export function setSession(token: string, role: SessionRole): boolean {
  writeSession(SESSION_TOKEN_KEY, token);
  writeSession(SESSION_ROLE_KEY, role);
  return readSession(SESSION_TOKEN_KEY) === token;
}

export function clearSession(): void {
  removeSession(SESSION_TOKEN_KEY);
  removeSession(SESSION_ROLE_KEY);
}

