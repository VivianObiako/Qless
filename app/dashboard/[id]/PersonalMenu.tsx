"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, Monitor, Moon, MoreHorizontal, Smartphone, Sun, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { ApiError, revokeOtherSessions } from "@/lib/api";
import { clearSession, sessionRoleKey, sessionTokenKey } from "@/lib/session";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useStoredValue } from "@/hooks/useStoredValue";
import { useTheme } from "@/hooks/useTheme";

interface PersonalMenuProps {
  /** "row" is the sidebar's bottom row; "avatar" is the compact top-bar form. */
  variant?: "row" | "avatar";
  /** Which way the panel opens. Up from the bottom of a sidebar, down from a bar. */
  opens?: "up" | "down";
  className?: string;
}

const appearances: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

/**
 * The bottom of the sidebar: who you are, and everything that follows you
 * between queues. Team for owners, appearance, and the two ways to sign out.
 *
 * An owner session has a role and nothing else, so the menu can only say
 * "Owner" until the business has a name to give it.
 */
export function PersonalMenu({
  variant = "row",
  opens = "up",
  className,
}: PersonalMenuProps): JSX.Element {
  const router = useRouter();
  const token = useStoredValue(sessionTokenKey());
  const role = useStoredValue(sessionRoleKey());
  const isOwner = role !== "OPERATOR";
  const { preference, setPreference } = useTheme();
  const { open, setOpen, toggle, containerRef, triggerRef, panelId } = useDisclosure();

  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const who = isOwner ? "Owner" : "Operator";
  const initial = who.charAt(0);

  function signOut(): void {
    clearSession();
    router.push("/");
  }

  async function revokeOthers(): Promise<void> {
    if (!token) return;
    setRevoking(true);
    try {
      await revokeOtherSessions(token);
      toast.success("Your other devices are signed out");
      setConfirmingRevoke(false);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setRevoking(false);
    }
  }

  const avatar = (
    <span
      aria-hidden="true"
      className="grid size-7 shrink-0 place-items-center rounded-full border border-shell-line bg-shell-mid text-[12.5px] text-strong"
    >
      {initial}
    </span>
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={variant === "avatar" ? "Your menu" : undefined}
        onClick={toggle}
        className={cn(
          "flex items-center gap-2.5 rounded-[10px] border border-transparent text-left transition-colors",
          variant === "row" && "w-full px-2 py-1.5 hover:border-shell-line",
          variant === "avatar" && "rounded-full p-0.5 hover:border-shell-line",
          open && "border-shell-line bg-shell-mid",
        )}
      >
        {avatar}
        {variant === "row" && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-strong">{who}</span>
              <span className="block text-[11.5px] text-muted">Signed in on this device</span>
            </span>
            <Icon icon={MoreHorizontal} size={15} className="text-muted" />
          </>
        )}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className={cn(
          "absolute z-30 w-[248px] rounded-[12px] border border-shell-line bg-shell-soft p-1.5",
          "shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_12px_32px_rgb(0_0_0_/_0.10)]",
          opens === "up" ? "bottom-full left-0 mb-1.5" : "right-0 top-full mt-1.5",
        )}
      >
        <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-1.5">
          {avatar}
          <span className="min-w-0">
            <span className="block text-[13.5px] font-medium text-strong">{who}</span>
            <span className="block text-[12px] text-muted">This device</span>
          </span>
        </div>
        <div className="mb-1.5 h-px bg-shell-line" />

        {isOwner && (
          <Link
            href="/operators"
            className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13.5px] text-strong transition-colors hover:bg-shell-mid"
          >
            <Icon icon={Users} size={15} className="text-muted" />
            Team
          </Link>
        )}

        <div className="px-2.5 pb-2 pt-2">
          <p className="mb-1.5 text-[12px] text-muted">Appearance</p>
          <div
            role="radiogroup"
            aria-label="Appearance"
            className="grid grid-cols-3 gap-1 rounded-[8px] bg-shell-mid p-1"
          >
            {appearances.map((option) => {
              const selected = option.value === preference;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPreference(option.value)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-[6px] px-1 py-1.5 text-[12px] transition-colors",
                    selected ? "bg-shell-soft font-medium text-strong" : "text-muted hover:text-strong",
                  )}
                >
                  <Icon icon={option.icon} size={14} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="my-1.5 h-px bg-shell-line" />

        {isOwner && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirmingRevoke(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13.5px] text-strong transition-colors hover:bg-shell-mid"
          >
            <Icon icon={Smartphone} size={15} className="text-muted" />
            Sign out other devices
          </button>
        )}
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13.5px] text-strong transition-colors hover:bg-shell-mid"
        >
          <Icon icon={LogOut} size={15} className="text-muted" />
          Sign out on this device
        </button>
      </div>

      <ConfirmDialog
        open={confirmingRevoke}
        onOpenChange={setConfirmingRevoke}
        title="Sign out your other devices?"
        description="Every other phone, tablet and computer signed in as the owner is signed out. This one stays. Staff are not affected."
        confirmLabel="Sign them out"
        cancelLabel="Keep them"
        destructive
        loading={revoking}
        onConfirm={() => void revokeOthers()}
      />
    </div>
  );
}
