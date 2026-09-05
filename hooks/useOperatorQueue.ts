"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  actOnEntry,
  actOnQueue,
  addWalkIn as apiAddWalkIn,
  getOperatorView,
  pauseQueue,
  queueSocketUrl,
  serveNext,
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
import type { EntryAction, OperatorEvent, OperatorView, QueueAction } from "@/lib/types";
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
  connection: ConnectionState;
  serveNextCustomer: () => Promise<void>;
  actOnCustomer: (entryId: string, action: EntryAction) => Promise<void>;
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

  const serveNextCustomer = useCallback(async (): Promise<void> => {
    if (!token) return;

    setServing(true);
    setActionError(null);
    try {
      // The action response is the new dashboard state, so the screen updates
      // from a single round trip rather than waiting for its own broadcast.
      setView(await serveNext(queueId, token));
    } catch (caught) {
      if (caught instanceof ApiError) setActionError(caught);
      void classify(caught);
    } finally {
      setServing(false);
    }
  }, [queueId, token, classify]);

  const actOnCustomer = useCallback(
    async (entryId: string, action: EntryAction): Promise<void> => {
      if (!token) return;

      setPendingEntryId(entryId);
      setActionError(null);
      try {
        setView(await actOnEntry(queueId, entryId, action, token));
      } catch (caught) {
        if (caught instanceof ApiError) setActionError(caught);
        // A stale row — someone else already dealt with this customer — is the
        // one failure worth resyncing for, since the screen is now wrong.
        if (caught instanceof ApiError && caught.code === "entry_not_active") void load();
        void classify(caught);
      } finally {
        setPendingEntryId(null);
      }
    },
    [queueId, token, load, classify],
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
    connection,
    serveNextCustomer,
    actOnCustomer,
    addWalkIn,
    addingWalkIn,
    actOnThisQueue,
    refresh,
  };
}

