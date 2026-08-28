"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, getQueue, joinQueue, leaveQueue, queueSocketUrl } from "@/lib/api";
import {
  clearJoinedAhead,
  customerTokenKey,
  joinedAheadKey,
  readSession,
  setCustomerToken,
  setJoinedAhead,
} from "@/lib/session";
import { customerViewFrom, entryIsStale, type CustomerView, type PublicEvent } from "@/lib/types";
import type { ConnectionState } from "@/components/LiveIndicator";
import { useQueueSocket } from "./useQueueSocket";
import { useStoredNumber } from "./useStoredValue";

interface CustomerQueue {
  view: CustomerView | null;
  loading: boolean;
  loadError: ApiError | null;
  actionError: ApiError | null;
  joining: boolean;
  leaving: boolean;
  joinedAhead: number | null;
  connection: ConnectionState;
  join: (name: string) => Promise<boolean>;
  leave: () => Promise<boolean>;
  refresh: () => void;
}

/**
 * Owns everything the customer page needs: the queue state, the browser's
 * anonymous token, the live connection, and the two actions a customer can
 * take.
 *
 * The socket carries public state only — numbers, never names — so the
 * customer's own entry comes from HTTP and is re-read whenever a frame arrives
 * that it can no longer be reconciled with.
 */
export function useCustomerQueue(slug: string): CustomerQueue {
  const [view, setView] = useState<CustomerView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const joinedAhead = useStoredNumber(joinedAheadKey(slug));

  // Held in a ref rather than state: the token is an input to requests, never
  // something the UI renders, so changing it should not force a render.
  const tokenRef = useRef<string | null>(null);

  // The latest view, readable from a socket callback that must not re-subscribe
  // every time the view changes.
  const viewRef = useRef<CustomerView | null>(null);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Bumped on every applied frame. A fetch that started before a frame landed
  // is older than the screen, and must not be allowed to undo it.
  const frameRef = useRef(0);

  const apply = useCallback((next: CustomerView): void => {
    viewRef.current = next;
    setView(next);
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      const startedAt = frameRef.current;
      try {
        const next = await getQueue(slug, tokenRef.current, signal);

        // If a live frame overtook this request, keep its newer public state
        // and take only the entry — which is the part we asked for.
        const current = viewRef.current;
        apply(
          frameRef.current === startedAt || !current
            ? next
            : customerViewFrom(current.state, next.entry),
        );
        setLoadError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (caught instanceof ApiError) setLoadError(caught);
      } finally {
        setLoading(false);
      }
    },
    [slug, apply],
  );

  useEffect(() => {
    tokenRef.current = readSession(customerTokenKey(slug));

    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [slug, load]);

  // Kept from milestone 1 alongside the socket, not replaced by it. A phone
  // that was asleep can hold a connection the browser has quietly frozen: it
  // still reads as open, and no frame ever arrives. Re-reading on focus costs
  // one request and closes that gap.
  useEffect(() => {
    const onFocus = (): void => {
      if (document.visibilityState === "visible") void load();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  const onEvent = useCallback(
    (event: PublicEvent): void => {
      const current = viewRef.current;
      // Nothing to merge into yet; the initial fetch is still in flight and
      // will arrive with state at least as fresh as this frame.
      if (!current) return;

      frameRef.current += 1;
      apply(customerViewFrom(event.state, current.entry));

      // The public frame says our number is no longer where we left it — we
      // were called, skipped or cleared, and only /me can say which.
      if (entryIsStale(event.state, current.entry)) void load();
    },
    [apply, load],
  );

  const onReconnect = useCallback((): void => {
    void load();
  }, [load]);

  const socketUrl = useMemo(() => queueSocketUrl(slug), [slug]);
  const connection = useQueueSocket<PublicEvent>({ url: socketUrl, onEvent, onReconnect });

  const join = useCallback(
    async (name: string): Promise<boolean> => {
      setJoining(true);
      setActionError(null);
      try {
        const result = await joinQueue(slug, name, tokenRef.current);

        tokenRef.current = result.customerToken;
        setCustomerToken(slug, result.customerToken);

        // Anchor the progress bar, but only for a genuinely new position.
        if (!result.alreadyJoined) {
          setJoinedAhead(slug, result.peopleAhead);
        }

        // A mutation response is the newest truth there is, frames included.
        frameRef.current += 1;
        apply(result);
        return true;
      } catch (caught) {
        if (caught instanceof ApiError) {
          setActionError(caught);
          // A rejected join usually means the queue changed underneath us.
          void load();
        }
        return false;
      } finally {
        setJoining(false);
      }
    },
    [slug, load, apply],
  );

  const leave = useCallback(async (): Promise<boolean> => {
    const token = tokenRef.current;
    if (!token) return false;

    setLeaving(true);
    setActionError(null);
    try {
      const next = await leaveQueue(slug, token);
      clearJoinedAhead(slug);
      frameRef.current += 1;
      apply(next);
      return true;
    } catch (caught) {
      if (caught instanceof ApiError) setActionError(caught);
      return false;
    } finally {
      setLeaving(false);
    }
  }, [slug, apply]);

  const refresh = useCallback((): void => {
    void load();
  }, [load]);

  return {
    view,
    loading,
    loadError,
    actionError,
    joining,
    leaving,
    joinedAhead,
    connection,
    join,
    leave,
    refresh,
  };
}

