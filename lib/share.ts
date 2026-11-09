import { toast } from "sonner";

/**
 * Opens the phone's own share sheet (WhatsApp, X, Instagram, SMS: whatever is
 * installed), and copies the link if the sheet fails.
 */
export async function shareQueueLink(queueName: string, url: string): Promise<void> {
  const data: ShareData = {
    title: queueName,
    text: `Join the queue at ${queueName}. Take a number on your phone and come back when it's your turn.`,
    url,
  };

  if (typeof navigator.share === "function" && (navigator.canShare?.(data) ?? true)) {
    try {
      await navigator.share(data);
      return;
    } catch (caught) {
      // Closing the sheet is a choice, not a failure.
      if (caught instanceof DOMException && caught.name === "AbortError") return;
    }
  }

  await copyQueueLink(url);
}

export async function copyQueueLink(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  } catch {
    toast.error("Couldn't copy. Select the link and copy it manually.");
  }
}

/** Phones, and Safari and Chrome on a Mac; most Windows browsers have no sheet. */
export function canShareLinks(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}
