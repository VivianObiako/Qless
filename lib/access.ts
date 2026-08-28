import { ApiError, getMyQueues } from "./api";

/**
 * What a 401 from a queue-scoped route actually meant.
 *
 * The server answers "unauthorized" to both "I have never heard of this token"
 * and "this token is real but this queue is not yours", and it does that on
 * purpose — telling them apart would confirm that a queue exists to somebody
 * holding a credential for a different business.
 *
 * The browser is allowed to know, because it is asking about its own session.
 * `GET /api/me/queues` is not queue-scoped, so it answers the half the client
 * needs: if the session still resolves, the session is fine and the queue is
 * the problem.
 */
export type AccessOutcome = "session-ended" | "not-permitted";

/**
 * Returns null when it could not tell — a network failure or a server error is
 * not an answer about access, and treating it as one would sign somebody out of
 * their own business over a dropped connection.
 */
export async function classifyUnauthorized(token: string): Promise<AccessOutcome | null> {
  try {
    await getMyQueues(token);
    return "not-permitted";
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 401) return "session-ended";
    return null;
  }
}

