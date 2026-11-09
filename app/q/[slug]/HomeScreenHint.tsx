"use client";

import { useSyncExternalStore, type JSX } from "react";
import { Notice } from "@/components/Notice";
import { needsHomeScreen, readDeviceFacts } from "@/lib/homeScreen";

const subscribeToNothing = (): (() => void) => (): void => {};
const onDevice = (): boolean => needsHomeScreen(readDeviceFacts());
const onServer = (): boolean => false;

/**
 * Shown before joining, not after: a Home Screen app keeps its own storage, so
 * a ticket taken in Safari would not be there when the icon is opened.
 */
export function HomeScreenHint(): JSX.Element | null {
  const show = useSyncExternalStore(subscribeToNothing, onDevice, onServer);
  if (!show) return null;

  return (
    <Notice title="On iPhone? Do this before you join" chip="!">
      iPhones only send alerts from the Home Screen. Tap Share, then Add to Home Screen, open Less Queues
      from there and take your number. Or join here and keep this page open.
    </Notice>
  );
}
