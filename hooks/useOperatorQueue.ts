"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  actOnEntry,
  actOnQueue,
  addWalkIn as apiAddWalkIn,
  getMyQueues,
  getOperatorView,
  leaveSeat,
  pauseQueue,
  queueSocketUrl,
  serveNext,
  takeSeat,
  updateSeat,
} from "@/lib/api";
import { classifyUnauthorized, type AccessOutcome } from "@/lib/access";
import {
  clearSession,
  getSessionRole,
  ownerTokenKey,
  sessionRoleKey,
  sessionTokenKey,
  setSession,
  type SessionRole,
} from "@/lib/session";
import type { EntryAction, OperatorEvent, OperatorView, QueueAction, Seat, UpdateSeatInput } from "@/lib/types";
import type { ConnectionState } from "@/components/LiveIndicator";
import { useQueueSocket } from "./useQueueSocket";
import { useIsClient, useStoredValue } from "./useStoredValue";

interface OperatorQueue {
  view: OperatorView | null;
  loading: boolean;
  loadError: ApiError | null;
  actionError: ApiError | null;
  serving: boolean;
  /** The entry id currently mid-action, so one row can show a spinner. */
  pendingEntryId: string | null;
  /** The lifecycle action in flight, if any. */
  pendingAction: QueueAction | null;
  hasToken: boolean;
  token: string | null;
  /**
   * Set once a 401 has been traced back to its cause: the session itself is
   * gone, or the session is fine and this queue is not on its list. Null while
   * access is working, or while a failure was something else entirely.
   */
  access: AccessOutcome | null;
  /** The role held at the moment access ended, for what the screen then says. */
  endedAs: SessionRole | null;
  /**
   * What this browser is signed in as. A principal's type never changes, so
   * reading it from storage cannot go stale — and a browser holding only a
   * pre-session token is an owner by definition, since operators did not exist
   * when those were issued.
   *
   * This decides which controls are drawn, never which are allowed. The server
   * checks every request regardless.
   */
  isOwner: boolean;
  /**
   * The signed-in person's own id, once known. It is how an operator's
   * counter finds their chair among the seats; null until the first load.
   */
  principalId: string | null;
  /** What they are called: the owner's name or the operator's, or empty. */
  myName: string;
  connection: ConnectionState;
  /** Calls the next person to a seat. With one seat the id may be left out. */
  serveNextCustomer: (seatId?: string) => Promise<void>;
  /** The seat matters only to "serve": where the call lands. */
  actOnCustomer: (entryId: string, action: EntryAction, seatId?: string) => Promise<void>;
  /** The seat mid-change, so one tile or card can show it. */
  pendingSeatId: string | null;
  takeChair: (seatId: string) => Promise<void>;
  leaveChair: (seatId: string) => Promise<void>;
  setChairOpen: (seatId: string, active: boolean) => Promise<void>;
  /** Owner only: who works a chair, or null for nobody. */
  assignChair: (seatId: string, worker: UpdateSeatInput["worker"]) => Promise<void>;
  /** Put somebody in the queue from the counter. Resolves false if refused. */
  addWalkIn: (name: string) => Promise<boolean>;
  addingWalkIn: boolean;
  /** Pause takes an optional note for the people who scan in meanwhile. */
  actOnThisQueue: (action: QueueAction, note?: string) => Promise<void>;
  refresh: () => void;
}

/**
 * Dashboard state. The session token arrives from this browser's storage, or in
 * the URL as `?k=…` when someone opens a shared dashboard link on a new device.
 *
 * The same token opens the socket, which is what makes this the one connection
 * in the product that receives customer names.
 */
export function useOperatorQueue(queueId: string, tokenFromUrl: string | null): OperatorQueue {
  const [view, setView] = useState<OperatorView | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [serving, setServing] = useState(false);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<QueueAction | null>(null);
  const [access, setAccess] = useState<AccessOutcome | null>(null);
  const [endedAs, setEndedAs] = useState<SessionRole | null>(null);
  const [pendingSeatId, setPendingSeatId] = useState<string | null>(null);

  const isClient = useIsClient();
  const sessionToken = useStoredValue(sessionTokenKey());
  // Where this browser kept the token before sessions existed. Read so that a
  // bookmarked dashboard from an earlier version still opens; promoted to a
  // session below, so it is read at most once.
  const legacyToken = useStoredValue(ownerTokenKey(queueId));
  const token = tokenFromUrl ?? sessionToken ?? legacyToken;
  const role = useStoredValue(sessionRoleKey());

  // Derived rather than stored: with no token there is nothing to await, and
  // setting a loading flag synchronously inside the effect would cascade.
  const loading = !isClient || (token !== null && view === null && loadError === null);

  // A token in the URL is a credential sitting in the address bar at a counter,
  // in browser history, and in every screenshot of this screen. It is stored
  // and then taken out of the URL — but only once the write is known to have
  // survived, because in a private window it may not, and this is the last
  // other copy of it.
  useEffect(() => {
    if (!tokenFromUrl) return;

    if (setSession(tokenFromUrl, "OWNER") && window.location.search) {
      // pushState/replaceState are wired into the Next router, so this updates
      // the URL without a navigation and without losing the mounted page.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [tokenFromUrl]);

  // The same promotion for a browser arriving with only a pre-session token:
  // it is a valid session token, it was simply filed under one queue's id.
  useEffect(() => {
    if (tokenFromUrl || sessionToken || !legacyToken) return;
    setSession(legacyToken, "OWNER");
  }, [tokenFromUrl, sessionToken, legacyToken]);

  /**
   * Works out what a 401 meant, and acts on it.
   *
   * A dashboard that has been open all afternoon can lose access two ways: the
   * owner withdrew the operator's code, or the owner unassigned this one queue.
   * The server says "unauthorized" to both. Asking `/api/me/queues` — which is
   * about the session and not about any queue — separates them, and only the
   * first is grounds for throwing the stored session away.
   */
  const classify = useCallback(
    async (caught: unknown): Promise<void> => {
      if (!(caught instanceof ApiError) || caught.status !== 401 || !token) return;

      const outcome = await classifyUnauthorized(token);
      if (outcome === null) return;

      if (outcome === "session-ended") {
        setEndedAs(getSessionRole());
        clearSession();
      }
      setAccess(outcome);
    },
    [token],
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const next = await getOperatorView(queueId, token ?? "", signal);
        setView(next);
        setLoadError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (caught instanceof ApiError) setLoadError(caught);
        void classify(caught);
      }
    },
    [queueId, token, classify],
  );

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    // Inlined rather than calling load(): the fetch is the subscription this
    // effect owns, and the state updates all happen after the await.
    void (async () => {
      try {
        const next = await getOperatorView(queueId, token, controller.signal);
        setView(next);
        setLoadError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (caught instanceof ApiError) setLoadError(caught);
        void classify(caught);
      }
    })();

    return () => controller.abort();
  }, [queueId, token, classify]);

  // Operator frames carry the whole dashboard, so there is nothing to merge and
  // nothing a late fetch could undo — the newest frame is simply the state.
  const onEvent = useCallback((event: OperatorEvent): void => {
    setView(event.view);
    setLoadError(null);
  }, []);

  const onReconnect = useCallback((): void => {
    void load();
  }, [load]);

  // A socket whose token has just been revoked would reconnect eight times
  // before giving up, on a screen that already knows the answer.
  const socketUrl = useMemo(
    () => (token && access === null ? queueSocketUrl(queueId, token) : null),
    [queueId, token, access],
  );
  const connection = useQueueSocket<OperatorEvent>({ url: socketUrl, onEvent, onReconnect });

  const me = useMe(token);

  const serveNextCustomer = useCallback(
    async (seatId?: string): Promise<void> => {
      if (!token) return;

      setServing(true);
      setActionError(null);
      try {
        // The action response is the new dashboard state, so the screen updates
        // from a single round trip rather than waiting for its own broadcast.
        setView(await serveNext(queueId, token, seatId));
      } catch (caught) {
        if (caught instanceof ApiError) setActionError(caught);
        // A chair that stopped being free under the operator — somebody else
        // called to it, or it was closed — is worth a resync for the same
        // reason a stale row is.
        if (caught instanceof ApiError && caught.status === 409) void load();
        void classify(caught);
      } finally {
        setServing(false);
      }
    },
    [queueId, token, load, classify],
  );

  const actOnCustomer = useCallback(
    async (entryId: string, action: EntryAction, seatId?: string): Promise<void> => {
      if (!token) return;

      setPendingEntryId(entryId);
      setActionError(null);
      try {
        setView(await actOnEntry(queueId, entryId, action, token, seatId));
      } catch (caught) {
        if (caught instanceof ApiError) setActionError(caught);
        // A stale row — someone else already dealt with this customer — is the
        // one failure worth resyncing for, since the screen is now wrong.
        if (caught instanceof ApiError && caught.status === 409) void load();
        void classify(caught);
      } finally {
        setPendingEntryId(null);
      }
    },
    [queueId, token, load, classify],
  );

  // Seat changes answer with the seat list alone; the rest of the view is
  // untouched by them, and the next frame carries the whole thing anyway.
  const changeSeat = useCallback(
    async (seatId: string, work: () => Promise<{ seats: Seat[] }>): Promise<void> => {
      if (!token) return;

      setPendingSeatId(seatId);
      setActionError(null);
      try {
        const result = await work();
        setView((current) => (current ? { ...current, seats: result.seats } : current));
      } catch (caught) {
        if (caught instanceof ApiError) setActionError(caught);
        if (caught instanceof ApiError && caught.status === 409) void load();
        void classify(caught);
      } finally {
        setPendingSeatId(null);
      }
    },
    [token, load, classify],
  );

  const takeChair = useCallback(
    (seatId: string): Promise<void> => changeSeat(seatId, () => takeSeat(queueId, seatId, token ?? "")),
    [changeSeat, queueId, token],
  );
  const leaveChair = useCallback(
    (seatId: string): Promise<void> => changeSeat(seatId, () => leaveSeat(queueId, seatId, token ?? "")),
    [changeSeat, queueId, token],
  );
  const setChairOpen = useCallback(
    (seatId: string, active: boolean): Promise<void> =>
      changeSeat(seatId, () => updateSeat(queueId, seatId, { active }, token ?? "")),
    [changeSeat, queueId, token],
  );
  const assignChair = useCallback(
    (seatId: string, worker: UpdateSeatInput["worker"]): Promise<void> =>
      changeSeat(seatId, () => updateSeat(queueId, seatId, { worker }, token ?? "")),
    [changeSeat, queueId, token],
  );

  const [addingWalkIn, setAddingWalkIn] = useState(false);

  const addWalkIn = useCallback(
    async (name: string): Promise<boolean> => {
      if (!token) return false;

      setAddingWalkIn(true);
      setActionError(null);
      try {
        setView(await apiAddWalkIn(queueId, name, token));
        return true;
      } catch (caught) {
        if (caught instanceof ApiError) setActionError(caught);
        void classify(caught);
        return false;
      } finally {
        setAddingWalkIn(false);
      }
    },
    [queueId, token, classify],
  );

  const actOnThisQueue = useCallback(
    async (action: QueueAction, note = ""): Promise<void> => {
      if (!token) return;

      setPendingAction(action);
      setActionError(null);
      try {
        setView(
          action === "pause"
            ? await pauseQueue(queueId, note, token)
            : await actOnQueue(queueId, action, token),
        );
      } catch (caught) {
        if (caught instanceof ApiError) setActionError(caught);
        void classify(caught);
      } finally {
        setPendingAction(null);
      }
    },
    [queueId, token, classify],
  );

  const refresh = useCallback((): void => {
    void load();
  }, [load]);

  return {
    view,
    loading,
    loadError,
    actionError,
    serving,
    pendingEntryId,
    pendingAction,
    hasToken: token !== null,
    token,
    access,
    endedAs,
    isOwner: role !== "OPERATOR",
    principalId: me.id,
    myName: me.name,
    connection,
    serveNextCustomer,
    actOnCustomer,
    pendingSeatId,
    takeChair,
    leaveChair,
    setChairOpen,
    assignChair,
    addWalkIn,
    addingWalkIn,
    actOnThisQueue,
    refresh,
  };
}


/**
 * Who this session is, kept across mounts like the switcher's list: every
 * dashboard screen renders its own chrome, and the answer does not change
 * for the life of a token.
 */
let rememberedMe: { token: string; id: string; name: string } | null = null;

function useMe(token: string | null): { id: string | null; name: string } {
  const [me, setMe] = useState<{ id: string | null; name: string }>(() =>
    rememberedMe && rememberedMe.token === token
      ? { id: rememberedMe.id, name: rememberedMe.name }
      : { id: null, name: "" },
  );

  useEffect(() => {
    if (!token) return;
    if (rememberedMe && rememberedMe.token === token) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const mine = await getMyQueues(token, controller.signal);
        rememberedMe = { token, id: mine.principalId, name: mine.displayName };
        setMe({ id: mine.principalId, name: mine.displayName });
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        // Without an id the counter cannot tell which chair is theirs, and
        // says so; a session that has ended is handled by the queue load.
        if (!(caught instanceof ApiError)) return;
      }
    })();

    return () => controller.abort();
  }, [token]);

  return me;
}
