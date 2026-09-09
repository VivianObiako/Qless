"use client";

import { useEffect, useState, type FormEvent, type JSX } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Monitor, Moon, Sun } from "lucide-react";
import { AccessNotice } from "@/components/AccessNotice";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { LinkButton } from "@/components/LinkButton";
import { Notice } from "@/components/Notice";
import { QueueArranging } from "@/components/QueueArranging";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
import { DashboardChrome } from "@/app/dashboard/[id]/DashboardChrome";
import { Section } from "@/app/dashboard/[id]/settings/parts";
import { ApiError, getMyQueues, getSeats, leaveSeat, revokeOtherSessions, takeSeat } from "@/lib/api";
import type { AccessOutcome } from "@/lib/access";
import { isMine } from "@/lib/seats";
import { clearSession, getSessionRole, sessionTokenKey, type SessionRole } from "@/lib/session";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useIsClient, useStoredValue } from "@/hooks/useStoredValue";
import { useOwnerName } from "@/hooks/useOwnerName";
import { useTheme } from "@/hooks/useTheme";
import type { QueueCard, Seat } from "@/lib/types";

/**
 * You, on this business. Everything here follows you between queues and
 * devices: your name, the chair each counter opens on for you, how the
 * screens look, and which devices are signed in.
 */
export function Profile(): JSX.Element {
  const isClient = useIsClient();
  const token = useStoredValue(sessionTokenKey());

  const [me, setMe] = useState<{ isOwner: boolean; principalId: string; name: string } | null>(null);
  const [queues, setQueues] = useState<QueueCard[]>([]);
  const [seatsByQueue, setSeatsByQueue] = useState<Record<string, Seat[]>>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [access, setAccess] = useState<AccessOutcome | null>(null);
  const [endedAs, setEndedAs] = useState<SessionRole | null>(null);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const mine = await getMyQueues(token, controller.signal);
        setMe({ isOwner: mine.role === "OWNER", principalId: mine.principalId, name: mine.displayName });
        setQueues(mine.queues);
        setError(null);

        const lists = await Promise.allSettled(
          mine.queues.map((queue) => getSeats(queue.id, token, controller.signal)),
        );
        if (controller.signal.aborted) return;
        const byQueue: Record<string, Seat[]> = {};
        mine.queues.forEach((queue, index) => {
          const list = lists[index];
          if (list.status === "fulfilled") byQueue[queue.id] = list.value.seats;
        });
        setSeatsByQueue(byQueue);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (!(caught instanceof ApiError)) return;
        setError(caught);
        // "My queues" is about the session itself, so a 401 here is the
        // session having ended, not one queue being out of reach.
        if (caught.status === 401) {
          setEndedAs(getSessionRole());
          clearSession();
          setAccess("session-ended");
        }
      }
    })();

    return () => controller.abort();
  }, [token]);

  function body(): JSX.Element {
    if (!isClient || (token && !me && !error)) {
      return <QueueArranging className="mx-auto max-w-md" label="Loading your profile" />;
    }

    if (access !== null) {
      return <AccessNotice outcome={access} role={endedAs} what="queue" />;
    }

    if (!token || error?.status === 401) {
      return (
        <Notice
          tone="standing"
          title="Sign in to see your profile"
          chip="!"
          action={<LinkButton href="/enter">Enter a code</LinkButton>}
        >
          Your profile is who you are on the queues you run.
        </Notice>
      );
    }

    if (error || !me) {
      return (
        <Notice tone="standing" title="Couldn't load your profile" chip="!">
          {error?.message ?? "Try again in a moment."}
        </Notice>
      );
    }

    return (
      <ProfileBody
        token={token}
        isOwner={me.isOwner}
        principalId={me.principalId}
        name={me.name}
        queues={queues}
        seatsByQueue={seatsByQueue}
        onSeatsChanged={(queueId, seats) => setSeatsByQueue((current) => ({ ...current, [queueId]: seats }))}
      />
    );
  }

  if (isClient && !token) {
    return <PlainShell>{body()}</PlainShell>;
  }

  return (
    <DashboardChrome tab="profile" heading="Profile" width="narrow">
      {body()}
    </DashboardChrome>
  );
}

/** The shell for a visitor with nothing to navigate yet. */
function PlainShell({ children }: { children: JSX.Element }): JSX.Element {
  return (
    <div className="min-h-dvh bg-shell">
      <header className="border-b border-shell-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5">
          <Wordmark />
          <ThemeToggle variant="quiet" className="sm:hidden" />
          <ThemeToggle className="hidden sm:inline-flex" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">{children}</main>
    </div>
  );
}

const appearances: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

function ProfileBody({
  token,
  isOwner,
  principalId,
  name,
  queues,
  seatsByQueue,
  onSeatsChanged,
}: {
  token: string;
  isOwner: boolean;
  principalId: string;
  name: string;
  queues: QueueCard[];
  seatsByQueue: Record<string, Seat[]>;
  onSeatsChanged: (queueId: string, seats: Seat[]) => void;
}): JSX.Element {
  const router = useRouter();
  const owner = useOwnerName();
  const { preference, setPreference } = useTheme();
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [busyQueue, setBusyQueue] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    const ok = await owner.rename(draft.trim());
    setSaving(false);
    if (ok) toast.success(draft.trim() ? "Name saved" : "Name removed");
    else toast.error("Couldn't save your name. Try again in a moment.");
  }

  // Sitting down at a chair from here is the same soft lock as the counter's
  // picker: whoever picks last has it. "No chair" is getting up.
  async function chooseSeat(queueId: string, seatId: string): Promise<void> {
    const seats = seatsByQueue[queueId] ?? [];
    const held = seats.find((seat) => isMine(seat, isOwner, principalId));
    setBusyQueue(queueId);
    try {
      const result =
        seatId === ""
          ? held
            ? await leaveSeat(queueId, held.id, token)
            : null
          : await takeSeat(queueId, seatId, token);
      if (result) onSeatsChanged(queueId, result.seats);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusyQueue(null);
    }
  }

  async function revokeOthers(): Promise<void> {
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

  function signOut(): void {
    clearSession();
    router.push("/");
  }

  return (
    <div>
      <h2 className="text-[clamp(30px,6vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
        Profile
      </h2>
      <p className="mt-3 max-w-lg text-[15px] leading-[1.6] text-dim">
        You, on this business. Everything here follows you between queues and devices.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8">
        <Section
          title="Name"
          description={
            isOwner
              ? "Shown on the chair you pick and beside the customers you serve. Staff and customers never see it."
              : "Shown on the chair you pick and beside the customers you serve. Customers never see it."
          }
        >
          {isOwner ? (
            <Field
              label="Your name"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              hint="Leave it empty and screens say “Owner”."
              placeholder="Ade"
              maxLength={60}
              autoComplete="name"
            />
          ) : (
            <p className="text-[15px] text-strong">
              {name || "Operator"}
              <span className="mt-1 block text-[12.5px] text-muted">
                Set by the owner on the Team page. Ask them to change it.
              </span>
            </p>
          )}
        </Section>

        <Section
          title="Where you work"
          description="The chair each counter opens on for you. Pick a different one on the counter any time."
        >
          {queues.length === 0 ? (
            <p className="text-[13.5px] text-muted">No queues yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-shell-line border-y border-shell-line">
              {queues.map((queue) => (
                <QueueSeatRow
                  key={queue.id}
                  queue={queue}
                  seats={seatsByQueue[queue.id] ?? []}
                  isOwner={isOwner}
                  principalId={principalId}
                  busy={busyQueue === queue.id}
                  onChoose={(seatId) => void chooseSeat(queue.id, seatId)}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Appearance" description="Light for a counter under shop lighting. System follows the device.">
          <div
            role="radiogroup"
            aria-label="Appearance"
            className="grid max-w-xs grid-cols-3 gap-1 rounded-[10px] bg-shell-mid p-1"
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
                    "flex items-center justify-center gap-1.5 rounded-[8px] px-2 py-2 text-[13px] transition-colors pointer-coarse:min-h-11",
                    selected ? "bg-shell-soft font-medium text-strong" : "text-muted hover:text-strong",
                  )}
                >
                  <Icon icon={option.icon} size={14} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          title="Devices"
          description={
            isOwner
              ? "Every phone, tablet and computer signed in as the owner."
              : "Every device you have entered your code on."
          }
        >
          <div className="flex flex-wrap gap-2">
            {isOwner && (
              <Button type="button" variant="ghost" size="md" onClick={() => setConfirmingRevoke(true)}>
                Sign out other devices
              </Button>
            )}
            <Button type="button" variant="ghost" size="md" onClick={signOut}>
              Sign out on this device
            </Button>
          </div>
          <p className="text-[13px] leading-[1.6] text-dim">
            {isOwner
              ? "Staff sign in with their own codes and are not affected."
              : "Your code keeps working on the others until the owner replaces it."}
          </p>
        </Section>

        {isOwner && (
          <div className="mt-8 flex flex-wrap gap-2 border-t border-shell-line pt-6">
            <Button type="submit" variant="contrast" size="md" loading={saving}>
              Save profile
            </Button>
          </div>
        )}
      </form>

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

/** One queue: how many chairs it has, which is yours, and a way to change that. */
function QueueSeatRow({
  queue,
  seats,
  isOwner,
  principalId,
  busy,
  onChoose,
}: {
  queue: QueueCard;
  seats: Seat[];
  isOwner: boolean;
  principalId: string;
  busy: boolean;
  onChoose: (seatId: string) => void;
}): JSX.Element {
  const held = seats.find((seat) => isMine(seat, isOwner, principalId)) ?? null;
  const selectId = `seat-${queue.id}`;
  const count = seats.length === 1 ? "1 seat" : `${seats.length} seats`;
  const single = seats.length <= 1;
  const fixed = !isOwner && queue.seatsFixed;

  const sub = single
    ? `${count} · no choice to make`
    : held
      ? `${count} · you are on ${held.name}`
      : fixed
        ? `${count} · ask the owner for a chair`
        : `${count} · no chair yet`;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-medium text-strong">{queue.name}</span>
        <span className="block text-[12.5px] text-muted">{sub}</span>
      </span>

      {single ? (
        <span className="text-[13.5px] text-dim">{seats[0]?.name ?? "Counter"}</span>
      ) : fixed ? (
        <span className="text-[13.5px] text-dim">{held?.name ?? "—"}</span>
      ) : (
        <>
          <label htmlFor={selectId} className="sr-only">
            Your chair at {queue.name}
          </label>
          <select
            id={selectId}
            value={held?.id ?? ""}
            disabled={busy}
            onChange={(event) => onChoose(event.target.value)}
            className="h-9 rounded-full border border-faint bg-transparent px-3 text-[13px] text-strong transition-colors hover:border-strong focus:border-strong focus:outline-none disabled:opacity-60 pointer-coarse:h-11"
          >
            <option value="">No chair</option>
            {seats.map((seat) => {
              const other = seat.worker !== null && seat.id !== held?.id;
              // Staff pick free chairs only; the owner any open one.
              const pickable = seat.active && (isOwner || !other) && seat.id !== held?.id;
              return (
                <option key={seat.id} value={seat.id} disabled={!pickable && seat.id !== held?.id}>
                  {seat.name}
                  {!seat.active ? " · closed" : other ? ` · ${seat.worker?.name || "Owner"}` : ""}
                </option>
              );
            })}
          </select>
        </>
      )}
    </li>
  );
}
