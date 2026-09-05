import { getPushKey, subscribePush, unsubscribePush } from "./api";

/** The browser can do this at all: a worker, a push manager, and a way to show the result. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Turns the permission the customer just granted into a subscription the API
 * can send to. Resolves false whenever push is not on offer — no worker, no
 * key on the server, a refusal from the browser — and the pass keeps its
 * in-page nudge in every one of those cases.
 */
export async function subscribeToPush(slug: string, customerToken: string): Promise<boolean> {
  if (!pushSupported()) return false;

  try {
    const key = await getPushKey();
    if (key === null) return false;

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (subscription === null) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(key),
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    await subscribePush(slug, { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }, customerToken);
    return true;
  } catch {
    return false;
  }
}

/** Forgets this browser's subscription for the queue. Best effort. */
export async function unsubscribeFromPush(slug: string, customerToken: string): Promise<void> {
  if (!pushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await unsubscribePush(slug, subscription.endpoint, customerToken);
  } catch {
    // The API forgets endpoints that stop answering; nothing to do here.
  }
}

/** The VAPID public key arrives base64url; the push manager wants bytes. */
function decodeKey(key: string): Uint8Array<ArrayBuffer> {
  const padded = (key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
