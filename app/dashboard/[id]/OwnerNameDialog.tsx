"use client";

import { useState, type FormEvent, type JSX } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Icon } from "@/components/Icon";

/**
 * The one field an owner has about themselves. It names the personal menu
 * and the entries they handle in history; it is not an account and nobody
 * else can see it.
 */
export function OwnerNameDialog({
  open,
  onOpenChange,
  name,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onSave: (name: string) => Promise<boolean>;
}): JSX.Element {
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave(draft.trim());
    setSaving(false);
    if (ok) {
      toast.success(draft.trim() ? "Name saved" : "Name removed");
      onOpenChange(false);
    } else {
      toast.error("Couldn't save your name. Try again in a moment.");
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(name);
        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-shell-line bg-shell-soft p-6 shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_24px_64px_rgb(0_0_0_/_0.18)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-[20px] font-medium leading-tight tracking-[-0.02em] text-strong">
                Your name
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-[13.5px] leading-[1.55] text-muted">
                Shown on your own screens and beside the customers you serve in history. Staff and
                customers never see it.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-shell-mid hover:text-strong"
            >
              <Icon icon={X} size={16} />
            </DialogPrimitive.Close>
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-5">
            <Field
              label="Name"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ade"
              maxLength={60}
              autoComplete="name"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="submit" variant="contrast" size="md" loading={saving}>
                Save
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
