"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ConnectionState } from "@/components/LiveIndicator";

interface QueueSocketOptions<TEvent> {
  /** The socket URL, or null to stay disconnected (no token yet, no queue). */
  url: string | null;
  onEvent: (event: TEvent) => void;
  /**
   * Called when a connection reopens after having dropped. The socket's own
   * snapshot restores the public state; this is where anything the socket
   * cannot know — the customer's own entry — gets refetched.
   */
  onReconnect: () => void;
}

const firstDelay = 500;
const maxDelay = 15_000;

// A socket that fails this many times in a row has hit something a retry will
// not fix — a revoked token, an API that is gone. It stops and waits for a
// signal that the world changed: the tab coming back, or the network returning.
const maxAttempts = 8;

function subscribeToNetwork(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether the device thinks it has a network. Read as an external store rather
 * than copied into state on mount: the server has no navigator, and assuming
 * online there keeps the first paint from claiming the customer is offline.
 */
function useIsOnline(): boolean {
  return useSyncExternalStore(
    subscribeToNetwork,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * One WebSocket, kept alive.
 *
 * Reconnection is the whole job here. A customer's phone locks, drops to a
 * tunnel, comes back on wifi — none of that should cost them their place or
 * leave them reading a position from ten minutes ago. So: exponential backoff
 * with jitter, an immediate retry when the tab is looked at again, and a full
 * refetch on every reopen.
 */
export function useQueueSocket<TEvent>({
  url,
  onEvent,
  onReconnect,
}: QueueSocketOptions<TEvent>): ConnectionState {
  const [connected, setConnected] = useState(false);
  const online = useIsOnline();

  // Callbacks live in refs so that a parent re-rendering with new closures
  // never tears down a healthy connection. Declared before the socket effect so
  // the refs are current by the time a frame can arrive.
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);

  useEffect(() => {
    onEventRef.current = onEvent;
    onReconnectRef.current = onReconnect;
  });

  useEffect(() => {
    if (!url) return;

    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let opened = false;
    let disposed = false;

    const clearRetry = (): void => {
      if (retry !== null) {
        clearTimeout(retry);
        retry = null;
      }
    };

    const schedule = (): void => {
      if (disposed || attempts >= maxAttempts) return;

      // Jitter keeps a shop full of phones from reconnecting in lockstep the
      // moment the wifi comes back.
      const backoff = Math.min(firstDelay * 2 ** attempts, maxDelay);
      const delay = backoff * (1 + Math.random() * 0.3);
      attempts += 1;

      clearRetry();
      retry = setTimeout(connect, delay);
    };

    function connect(): void {
      if (disposed || !url) return;

      const next = new WebSocket(url);
      socket = next;

      next.onopen = (): void => {
        if (disposed) return;
        attempts = 0;
        setConnected(true);

        // Only on a genuine reconnect: the first connection is already
        // accompanied by the initial fetch the caller made.
        if (opened) onReconnectRef.current();
        opened = true;
      };

      next.onmessage = (message: MessageEvent<string>): void => {
        if (disposed) return;
        try {
          onEventRef.current(JSON.parse(message.data) as TEvent);
        } catch {
          // A frame we cannot parse is a frame we cannot act on. The next one
          // carries a full snapshot, so dropping this one costs nothing.
        }
      };

      next.onclose = (): void => {
        if (disposed || socket !== next) return;
        setConnected(false);
        schedule();
      };

      // onerror always precedes onclose; letting close alone drive the retry
      // keeps one failure from scheduling two reconnects.
      next.onerror = (): void => {};
    }

    // Coming back to the tab, or back onto a network, is the moment a stale
    // position is most misleading — reconnect now rather than waiting out a
    // backoff that may have grown to fifteen seconds.
    const revive = (): void => {
      if (disposed || document.visibilityState !== "visible") return;
      if (socket && socket.readyState === WebSocket.OPEN) return;

      attempts = 0;
      clearRetry();
      connect();
    };

    connect();

    document.addEventListener("visibilitychange", revive);
    window.addEventListener("focus", revive);
    window.addEventListener("online", revive);

    return () => {
      disposed = true;
      clearRetry();
      document.removeEventListener("visibilitychange", revive);
      window.removeEventListener("focus", revive);
      window.removeEventListener("online", revive);

      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [url]);

  if (connected) return "live";
  return online ? "reconnecting" : "offline";
}

