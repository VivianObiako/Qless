"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, getQueue, queueSocketUrl } from "@/lib/api";
import type { PublicEvent, PublicState } from "@/lib/types";
import type { ConnectionState } from "@/components/LiveIndicator";
import { useQueueSocket } from "./useQueueSocket";

interface PublicQueue {
  state: PublicState | null;
  loading: boolean;
  loadError: ApiError | null;
  connection: ConnectionState;
}

/**
 * The queue as anyone may see it: numbers, counts and status, with no customer
 * token and no session.
 *
 * `useCustomerQueue` is the same socket plus an identity — an entry to
 * reconcile, a place to hold, actions to take. A screen on a wall has none of
 * that, and giving it a customer token would make the board a participant in
 * its own queue.
 */
export function usePublicQueue(slug: string): PublicQueue {
  const [state, setState] = useState<PublicState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const view = await getQueue(slug, null, signal);
        setState(view.state);
        setLoadError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (caught instanceof ApiError) setLoadError(caught);
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    const controller = new AbortController();

    // Inlined rather than calling load(): the fetch is the subscription this
    // effect owns, and every state update happens after the await.
    void (async () => {
      try {
        const view = await getQueue(slug, null, controller.signal);
        setState(view.state);
        setLoadError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (caught instanceof ApiError) setLoadError(caught);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [slug]);

  // Every frame carries a full snapshot of the public state, so there is
  // nothing to merge and no ordering to police — the newest frame is the board.
  const onEvent = useCallback((event: PublicEvent): void => {
    setState(event.state);
    setLoadError(null);
  }, []);

  const onReconnect = useCallback((): void => {
    void load();
  }, [load]);

  const url = useMemo(() => queueSocketUrl(slug), [slug]);
  const connection = useQueueSocket<PublicEvent>({ url, onEvent, onReconnect });

  return { state, loading, loadError, connection };
}
