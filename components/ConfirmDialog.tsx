"use client";

import type { JSX, ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

/**
 * Confirmation for operations that cannot be undone. Built on the registry's
 * alert dialog, which gives us role="alertdialog", focus trapping and restore,
 * and Escape handling without hand-rolling any of it.
 *
 * Destructive is carried by the dialog itself and the words on its buttons,
 * never by colour: both buttons are drawn the same whether or not the action
 * is destructive. Vermilion means a person being called; spending it on a
 * confirm button would cost it that meaning everywhere else. The flag stays
 * on the props so a caller states what it is asking for.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps): JSX.Element {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* data-destructive: the fact travels with the dialog for tests and
          tooling even though nothing is drawn from it. */}
      <AlertDialogContent
        data-destructive={destructive || undefined}
        className="max-w-sm rounded-[var(--radius-panel)] border-shell-line bg-shell-soft"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[20px] font-medium leading-tight tracking-[-0.02em] text-strong">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[13.5px] leading-[1.55] text-dim">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={loading}
            className="h-[38px] rounded-full border-faint bg-transparent px-4 text-[13.5px] font-medium text-strong hover:border-strong hover:bg-shell-mid"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading || undefined}
            // Ink either way: escalation in this product is carried by the
            // confirm step itself, not by a red button.
            className="h-[38px] rounded-full bg-strong px-4 text-[13.5px] font-medium text-shell hover:opacity-90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

