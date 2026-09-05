"use client";

import { useState, type JSX, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { Icon } from "@/components/Icon";
import { QueueForm } from "./CreateQueueForm";
import type { CreateQueueResponse } from "@/lib/types";

/**
 * Creating a second queue from inside the dashboard, without leaving it.
 *
 * The full-page /create screen exists for a visitor with nothing yet; an
 * owner adding a queue is one form away from running it, so the form comes
 * to them. A recovery code cannot appear here — this browser already holds a
 * session, and a code is only ever issued when a business is created — so
 * the dialog goes straight to the new queue's counter.
 */
export function CreateQueueDialog({ trigger }: { trigger: ReactNode }): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function onCreated(created: CreateQueueResponse): void {
    setOpen(false);
    router.push(`/dashboard/${created.queue.id}`);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-shell-line bg-shell-soft p-6 shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_24px_64px_rgb(0_0_0_/_0.18)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 sm:p-7"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-[22px] font-medium leading-tight tracking-[-0.02em] text-strong">
                New queue
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-[13.5px] leading-[1.55] text-muted">
                It joins this business. You will land on its counter when it is ready.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-shell-mid hover:text-strong"
            >
              <Icon icon={X} size={16} />
            </DialogPrimitive.Close>
          </div>

          <div className="mt-5">
            <QueueForm onCreated={onCreated} submitLabel="Create queue" compact />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
