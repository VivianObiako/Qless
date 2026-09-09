"use client";

import { useEffect, useState, type FormEvent, type JSX } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { ApiError, createSeat, getSeats, removeSeat, updateQueue, updateSeat } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Queue, Seat, ServiceMeasure } from "@/lib/types";
import { SaveRow, Section, Switch } from "./parts";

interface SeatsTabProps {
  queueId: string;
  queue: Queue;
  seats: Seat[];
  measured: ServiceMeasure;
  token: string;
  onSaved: (queue: Queue) => void;
  onSeatsChanged: (seats: Seat[]) => void;
  onDirty: (dirty: boolean) => void;
}

/**
 * Where people are served. Names and the fixed-chairs setting save with the
 * button, like every other tab; adding, ordering, opening, closing and
 * removing a chair happen at once, because each is a rule the server
 * answers on its own — a chair somebody is on cannot be closed, and the
 * answer belongs next to the switch that asked.
 */
export function SeatsTab({
  queueId,
  queue,
  seats,
  measured,
  token,
  onSaved,
  onSeatsChanged,
  onDirty,
}: SeatsTabProps): JSX.Element {
  // Only what has been typed: a seat with no edit shows its own name, so a
  // list that changes underneath keeps every edit and needs no syncing.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [fixed, setFixed] = useState(queue.seatsFixed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Seat | null>(null);

  const nameOf = (seat: Seat): string => edits[seat.id] ?? seat.name;
  const renamed = seats.filter((seat) => nameOf(seat).trim() !== seat.name);
  const dirty = renamed.length > 0 || fixed !== queue.seatsFixed;

  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);

  async function act(seatId: string, work: () => Promise<{ seats: Seat[] }>): Promise<void> {
    setBusy(seatId);
    try {
      const result = await work();
      onSeatsChanged(result.seats);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    for (const seat of renamed) {
      if (!nameOf(seat).trim()) {
        setError("Every chair needs a name.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      let latest = seats;
      for (const seat of renamed) {
        const result = await updateSeat(queueId, seat.id, { name: nameOf(seat).trim() }, token);
        latest = result.seats;
      }
      if (renamed.length > 0) onSeatsChanged(latest);
      setEdits({});

      if (fixed !== queue.seatsFixed) {
        const view = await updateQueue(queueId, { seatsFixed: fixed }, token);
        onSaved(view.queue);
      }
      toast.success("Settings saved");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const openCount = seats.filter((seat) => seat.active).length;
  const idle = seats.filter((seat) => seat.active && seat.worker === null).length;

  return (
    <form onSubmit={onSubmit} noValidate>
      <Section
        title="Seats"
        description="Where people are served. More than one, and everyone waiting shares one line for all of them."
      >
        <ul className="flex flex-col divide-y divide-shell-line border-y border-shell-line">
          {seats.map((seat, index) => (
            <li key={seat.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <label className="sr-only" htmlFor={`seat-name-${seat.id}`}>
                Name of chair {index + 1}
              </label>
              <input
                id={`seat-name-${seat.id}`}
                value={nameOf(seat)}
                onChange={(event) => setEdits((current) => ({ ...current, [seat.id]: event.target.value }))}
                maxLength={40}
                className={cn(
                  "h-10 min-w-0 flex-1 rounded-[10px] border border-transparent bg-transparent px-2.5 text-[15px] text-strong",
                  "transition-[border-color,background-color] hover:border-faint focus:border-strong focus:bg-shell-soft focus:outline-none",
                  !seat.active && "text-dim",
                )}
              />
              <span className="w-[9ch] shrink-0 truncate text-[13px] text-muted">
                {seat.worker ? seat.worker.name || "Owner" : "Nobody yet"}
              </span>

              <Switch
                label="Open"
                checked={seat.active}
                disabled={busy === seat.id}
                onChange={(active) => void act(seat.id, () => updateSeat(queueId, seat.id, { active }, token))}
              />

              <span className="flex items-center gap-0.5">
                <IconButton
                  label={`Move ${seat.name} up`}
                  disabled={index === 0 || busy !== null}
                  onClick={() => void act(seat.id, () => updateSeat(queueId, seat.id, { position: index }, token))}
                >
                  <Icon icon={ChevronUp} size={16} />
                </IconButton>
                <IconButton
                  label={`Move ${seat.name} down`}
                  disabled={index === seats.length - 1 || busy !== null}
                  onClick={() => void act(seat.id, () => updateSeat(queueId, seat.id, { position: index + 2 }, token))}
                >
                  <Icon icon={ChevronDown} size={16} />
                </IconButton>
              </span>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={seats.length === 1 || busy !== null}
                onClick={() => setRemoving(seat)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>

        <AddSeat
          disabled={busy !== null}
          onAdd={(name) =>
            act("new", async () => {
              await createSeat(queueId, name, token);
              return getSeats(queueId, token);
            })
          }
        />

        <p className="text-[13px] leading-[1.6] text-dim">
          The wait estimate divides by the seats that are open{openCount > 1 ? ` — ${openCount} right now` : ""}.
          Close a seat when nobody is at it, or customers are promised a shorter wait than they will get.
          {idle > 0 && openCount > 1 && (
            <>
              {" "}
              {idle === 1 ? "One open seat has nobody at it" : `${idle} open seats have nobody at them`}, so the
              estimate is optimistic until somebody takes {idle === 1 ? "it" : "them"} or you close{" "}
              {idle === 1 ? "it" : "them"}.
            </>
          )}
        </p>
        <p className="text-[13px] leading-[1.6] text-dim">
          Seat names are public: a customer is told “Go to {seats[1]?.name ?? "Chair 2"}” on their pass and
          in a notification. “Chair 2” is fine; a person’s name less so.
        </p>
        {measured.sample > 0 && openCount > 1 && (
          <p className="text-[13px] leading-[1.6] text-dim">
            Service has been taking about {measured.minutes} min per seat lately.
          </p>
        )}
      </Section>

      <Section title="Who sits where" description="Whether staff choose their own chair.">
        <Switch
          label="Chairs are fixed"
          description="Staff work the chair you give them on the Team page and cannot pick another. Off, they pick any free chair on the counter and can move to another free one."
          checked={fixed}
          onChange={setFixed}
        />
      </Section>

      <SaveRow error={error} saving={saving} />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={`Remove ${removing?.name ?? "this chair"}?`}
        description="It leaves the counter, the wall and the estimate. History still says who was served there."
        confirmLabel="Remove it"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => {
          const seat = removing;
          setRemoving(null);
          if (seat) void act(seat.id, () => removeSeat(queueId, seat.id, token));
        }}
      />
    </form>
  );
}

function AddSeat({ disabled, onAdd }: { disabled: boolean; onAdd: (name: string) => Promise<void> }): JSX.Element {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  async function add(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    await onAdd(trimmed);
    setName("");
    setAdding(false);
  }

  return (
    <div className="flex items-end gap-2">
      <Field
        label="Add a seat"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void add();
          }
        }}
        hint="Name them the way you say them out loud."
        placeholder="Chair 2"
        maxLength={40}
        className="flex-1"
      />
      {/* Aligned with the input, above the hint, so the row reads as one control. */}
      <Button
        type="button"
        variant="ghost"
        size="md"
        className="mb-[26px] h-11"
        disabled={disabled || !name.trim()}
        loading={adding}
        onClick={() => void add()}
      >
        Add
      </Button>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: JSX.Element;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full text-dim transition-colors hover:bg-shell-mid hover:text-strong disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent pointer-coarse:size-11"
    >
      {children}
    </button>
  );
}
