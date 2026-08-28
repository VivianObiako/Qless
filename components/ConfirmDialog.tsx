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
import { cn } from "@/lib/utils";

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
 * Destructive is carried by inversion and weight, never by colour. Vermilion
 * means "it's your turn" and appears on exactly two surfaces in the product;
 * spending it on a confirm button would cost it that meaning everywhere else.
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
      <AlertDialogContent className="max-w-sm rounded-[var(--radius-panel)] border-shell-line bg-shell-soft">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-[22px] leading-tight tracking-[-0.01em] text-strong">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="font-mono text-[12px] leading-[1.6] text-dim">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={loading}
            className="rounded-[var(--radius-control)] border-faint bg-transparent font-mono text-[11px] uppercase tracking-[0.18em] text-muted hover:border-strong hover:bg-transparent hover:text-strong"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading || undefined}
            className={cn(
              "rounded-[var(--radius-control)] font-mono text-[11px] uppercase tracking-[0.18em]",
              destructive
                ? "bg-strong text-shell hover:opacity-90"
                : "bg-paper text-paper-ink hover:bg-white",
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

