"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Proximity } from "@/lib/types";

/**
 * What this browser will let us do. "unsupported" and "denied" are different
 * facts but the same outcome — no notification — and the screen treats them
 * differently only in what it says, never in what it offers.
 */
export type AlertPermission = "unsupported" | "default" | "granted" | "denied";

interface TurnNotificationsInput {
  /** Null while the customer holds no active place. */
  proximity: Proximity | null;
  /** The customer's own number. Rejoining resets the ladder. */
  number: number | null;
  peopleAhead: number;
  queueName: string;
}

interface TurnNotifications {
  permission: AlertPermission;
  /** Opens the browser's own prompt. Never called on the customer's behalf. */
  request: () => void;
}

/** How far along the ladder each state is. Only a rise is worth announcing. */
const rank: Record<Proximity, number> = { waiting: 0, close: 1, next: 2, current: 3 };

function readPermission(): AlertPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

const subscribeToNothing = (): (() => void) => (): void => {};

/** The server has no Notification, so it always renders the unsupported case. */
const unsupported = (): AlertPermission => "unsupported";

/**
 * The nudge that makes "walk away" a real instruction: three away, one away,
 * your turn.
 *
 * Opt-in and load-bearing for nothing. The page carries every one of these
 * states on its own, at a size nobody can miss, so a browser that has no
 * Notification API — or a customer who said no — loses a convenience and not
 * the product.
 */
export function useTurnNotifications({
  proximity,
  number,
  peopleAhead,
  queueName,
}: TurnNotificationsInput): TurnNotifications {
  // Read as an external store rather than copied into state on mount, so the
  // opt-in never flashes past a browser that has already answered.
  const standing = useSyncExternalStore(subscribeToNothing, readPermission, unsupported);

  // The prompt's answer. `Notification.permission` does not notify anybody when
  // it changes, so the one moment it can change under us is the one moment we
  // are holding the result.
  const [answer, setAnswer] = useState<AlertPermission | null>(null);
  const permission = answer ?? standing;

  const announced = useRef(-1);
  const entry = useRef<number | null>(null);

  const request = useCallback((): void => {
    if (readPermission() === "unsupported") return;
    void Notification.requestPermission().then(setAnswer, () => setAnswer("denied"));
  }, [setAnswer]);

  useEffect(() => {
    if (proximity === null || number === null) {
      announced.current = -1;
      entry.current = null;
      return;
    }

    // A new number is a new wait. Somebody who was skipped and rejoined should
    // be told they are getting close all over again.
    if (entry.current !== number) {
      entry.current = number;
      announced.current = -1;
    }

    const reached = rank[proximity];
    if (reached <= announced.current) return;
    announced.current = reached;

    if (reached === 0 || permission !== "granted") return;

    // Nothing to add while the customer is looking at the screen: the screen is
    // already the loudest thing in the room, and a notification on top of it is
    // a second alert for something they have not missed.
    if (document.visibilityState === "visible") return;

    const message = messageFor(proximity, number, peopleAhead, queueName);
    if (message === null) return;

    try {
      const notification = new Notification(message.title, {
        body: message.body,
        // One notification per queue. Getting close and then being called
        // should replace, not stack.
        tag: `qless-${queueName}`,
      });
      notification.onclick = (): void => {
        window.focus();
        notification.close();
      };
    } catch {
      // Android Chrome refuses the constructor outright and insists on a
      // service worker. There is no fallback worth building for a convenience:
      // the page still says everything this would have.
    }
  }, [proximity, number, peopleAhead, queueName, permission]);

  return { permission, request };
}

interface AlertMessage {
  title: string;
  body: string;
}

function messageFor(
  proximity: Proximity,
  number: number,
  peopleAhead: number,
  queueName: string,
): AlertMessage | null {
  switch (proximity) {
    case "close":
      return {
        title: "You're getting close",
        body: `#${number} at ${queueName}. ${
          peopleAhead === 1 ? "One person" : `${peopleAhead} people`
        } ahead — start heading back.`,
      };
    case "next":
      return {
        title: "You're next",
        body: `#${number} at ${queueName}. Be inside now.`,
      };
    case "current":
      return {
        title: "It's your turn",
        body: `#${number} at ${queueName}. Head to the counter.`,
      };
    default:
      return null;
  }
}
