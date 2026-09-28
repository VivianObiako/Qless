"use client";

import { useEffect, useRef, type JSX, type ReactNode } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Icon } from "@/components/Icon";
import { MonoLabel } from "@/components/Label";
import { LiveIndicator } from "@/components/LiveIndicator";
import { Notice } from "@/components/Notice";
import { Numeral } from "@/components/Numeral";
import { QrCode } from "@/components/QrCode";
import { QueueArranging } from "@/components/QueueArranging";
import { usePublicQueue } from "@/hooks/usePublicQueue";
import { useOrigin } from "@/hooks/useStoredValue";
import { useChime } from "@/hooks/useChime";
import { useWakeLock } from "@/hooks/useWakeLock";
import { cn } from "@/lib/utils";
import { isDraw, nounFor, type PublicSeat, type PublicState, type QueueStatus, type ServingSlot } from "@/lib/types";

/** How many numbers the "up next" row carries, per the handoff. */
const UP_NEXT = 3;

/** Up to this many chairs sit in a row; above it the wall becomes a list. */
const CHAIRS_IN_A_ROW = 4;

/**
 * The screen on the wall.
 *
 * It is the only surface in the product with no identity at all: no session, no
 * customer token, no role. It opens the public socket and renders what everyone
 * in the room is entitled to see — numbers, a count, and a code to join by.
 * There is nothing to leak here because there is nothing to leak *from*; the
 * public frame has never carried a name.
 */
export function DisplayBoard({ slug }: { slug: string }): JSX.Element {
  const queue = usePublicQueue(slug);
  const origin = useOrigin();

  // A wall screen that goes to sleep is a blank wall.
  useWakeLock();

  // A tone when a new number is called to any chair, once the board has
  // been told to. The first frame and a reconnect are not calls; only the
  // set of numbers being served gaining one it did not have is. Somebody
  // finishing changes nothing the room needs to hear.
  const chime = useChime();
  const lastServing = useRef<string | undefined>(undefined);
  const servingKey = queue.state ? queue.state.serving.map((slot) => slot.number).join(",") : undefined;
  useEffect(() => {
    if (servingKey === undefined) return;
    const previous = lastServing.current;
    lastServing.current = servingKey;
    if (previous === undefined || previous === servingKey) return;
    const before = new Set(previous.split(",").filter(Boolean));
    const called = servingKey.split(",").filter(Boolean).some((number) => !before.has(number));
    if (called) chime.play();
  }, [servingKey, chime]);

  if (queue.loading) {
    return (
      <Frame>
        <QueueArranging
          className="m-auto w-full max-w-md"
          label="Loading the board"
        />
      </Frame>
    );
  }

  if (queue.loadError || !queue.state) {
    return (
      <Frame>
        <div className="m-auto w-full max-w-md">
          <Notice tone="standing" title="We couldn't find this queue" chip="!">
            {queue.loadError?.message ?? "Check the address on this screen."}
          </Notice>
        </div>
      </Frame>
    );
  }

  const { state } = queue;
  const draw = isDraw(state.queue);
  const upNext = state.waitingNumbers.slice(0, UP_NEXT);

  const controls = (
    <>
      <button
        type="button"
        onClick={chime.toggle}
        aria-pressed={chime.armed}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors",
          chime.armed
            ? "border-white/70 text-white"
            : "border-white/25 text-white/60 hover:border-white/50 hover:text-white",
        )}
      >
        <Icon icon={chime.armed ? Volume2 : VolumeX} size={14} />
        {chime.armed ? "Sound on" : "Sound off"}
      </button>
      <LiveIndicator state={queue.connection} />
    </>
  );

  return (
    <Frame>
      <div className="mb-7 flex items-center justify-between gap-4 lg:hidden">
        {controls}
      </div>
      <div className="flex flex-1 flex-col gap-9 lg:flex-row lg:gap-10">
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-9">
          {/* Unseen: the board's title is the venue, and on a wall that is the
              wall. It is in the footer line for anybody in the room and here
              for anybody reading the page. */}
          <h1 className="sr-only">{state.queue.name} — queue board</h1>

          <MonoLabel
            size={13}
            tone="inherit"
            className="text-display-label lg:text-[17px]"
          >
            Now serving
          </MonoLabel>

          {/*
            One live region for the board. Polite, and it announces the number
            rather than every count that moved with it — a wall screen that
            interrupts is worse than one nobody hears.
          */}
          <div role="status" aria-live="polite" className="min-w-0">
            <span className="sr-only">{servingAnnouncement(state)}</span>
            <div aria-hidden="true">
              {state.seats.length <= 1 ? (
                <Numeral
                  value={state.servingNumber}
                  scale="display"
                  className="text-strong md:text-[clamp(180px,32vw,320px)] lg:text-[clamp(180px,24vw,340px)]"
                />
              ) : (
                <Chairs seats={state.seats} serving={state.serving} />
              )}
            </div>
          </div>

          <div className="border-t border-white/15 pt-6">
            <MonoLabel size={13} tone="muted" className="lg:text-[15px]">
              Up next
            </MonoLabel>

            {draw ? (
              <DrawnNext state={state} />
            ) : upNext.length === 0 ? (
              <p className="mt-2.5 font-sans text-[clamp(28px,5vw,44px)] leading-none text-muted">
                Nobody waiting
              </p>
            ) : (
              <ol className="mt-2.5 flex items-baseline gap-6 lg:gap-[26px]">
                {upNext.map((number, index) => (
                  <li
                    // Keyed by the number so a queue that advances replays the
                    // change animation instead of quietly swapping digits.
                    key={number}
                    className={upNextClasses[index]}
                  >
                    {number}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <p className="text-[clamp(13px,1.4vw,16px)] text-muted">
            {state.queue.name}
            <span aria-hidden="true"> · </span>
            {draw ? `${state.waitingCount} still to go` : `${state.waitingCount} ${nounFor(state.queue, 2)} waiting`}
            {statusSuffix(state.queue.status)}
            {state.queue.status === "PAUSED" && state.queue.pauseNote && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="text-strong">{state.queue.pauseNote}</span>
              </>
            )}
          </p>
        </div>

        <div
          aria-hidden="true"
          className="hidden w-px shrink-0 bg-white/15 lg:block"
        />

        <div className="flex shrink-0 flex-col justify-between gap-6 lg:w-[clamp(220px,22vw,380px)]">
          {/* Staff read this from across the room to know the board is still
              the queue and not a photograph of it. The sound control sits
              with it: both are for whoever set the screen up, not the room.
              Beside the code when there is a column for it; otherwise at the
              top of the board, where the eye expects a status. */}
          <div className="hidden items-center justify-end gap-4 lg:flex">
            {controls}
          </div>

          <div className="flex flex-col items-center gap-4">
            <JoinCode origin={origin} state={state} />
            <div className="text-center">
              <MonoLabel size={13} tone="muted" className="block">
                Scan to join the queue
              </MonoLabel>
              {/* For a camera that will not lock on. Short, and the same on
                  the print sheet. */}
              {origin && (
                <p className="mt-1.5 font-mono text-[clamp(13px,1.2vw,16px)] text-strong">
                  {`${origin.replace(/^https?:\/\//, "")}/q/${state.queue.slug}`}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/**
 * Up next in a draw: the one number drawn, alone. Nothing else is shown,
 * because nothing else is known: the rest have no order until they are drawn.
 */
function DrawnNext({ state }: { state: PublicState }): JSX.Element {
  if (state.upNextNumber !== null) {
    return (
      <p key={state.upNextNumber} className={cn("mt-2.5", upNextClasses[0])}>
        {state.upNextNumber}
      </p>
    );
  }
  return (
    <p className="mt-2.5 font-sans text-[clamp(28px,5vw,44px)] leading-none text-muted">
      {state.waitingCount === 0
        ? state.serving.length > 0 || state.placesTaken > 0
          ? "That's everyone"
          : "Nobody has a number yet"
        : "Not drawn yet"}
    </p>
  );
}

/** What the room is told, in words, when the numbers change. */
function servingAnnouncement(state: PublicState): string {
  const drawn = isDraw(state.queue) && state.upNextNumber !== null ? ` Number ${state.upNextNumber} is up next.` : "";
  if (state.serving.length === 0) return `Nobody is being served yet.${drawn}`;
  if (state.seats.length <= 1) return `Now serving number ${state.servingNumber}.${drawn}`;
  return `Now serving ${state.serving.map((slot) => `${slot.number} at ${slot.seatName}`).join(", ")}.${drawn}`;
}

/**
 * Every chair, with the number at it. Up to four sit in a row, a number
 * under each chair's name and a dash where nobody is; above four the wall
 * becomes a list — number, chair, who — sized to the count. A closed chair
 * says so rather than disappearing, so the room can see why one barber is
 * not calling.
 */
function Chairs({ seats, serving }: { seats: PublicSeat[]; serving: ServingSlot[] }): JSX.Element {
  const byId = new Map(serving.map((slot) => [slot.seatId, slot]));
  const chairs = seats.map((seat) => ({ seat, slot: byId.get(seat.id) ?? null }));

  if (chairs.length > CHAIRS_IN_A_ROW) {
    const dense = chairs.length > 8;
    return (
      <ol className={cn("flex flex-col", dense ? "gap-1" : "gap-2")}>
        {chairs.map(({ seat, slot }) => (
          <li
            key={seat.id}
            className={cn(
              "flex items-baseline gap-5 border-b border-white/10 pb-1.5 lg:gap-8",
              !seat.active && "opacity-40",
            )}
          >
            <span
              className={cn(
                "numeral w-[3ch] text-right",
                dense ? "text-[clamp(28px,4vw,48px)]" : "text-[clamp(36px,5.5vw,72px)]",
                slot ? "text-strong" : "text-white/40",
              )}
            >
              {slot ? slot.number : "—"}
            </span>
            <span className={cn("font-sans text-strong", dense ? "text-[clamp(16px,2vw,24px)]" : "text-[clamp(20px,2.6vw,32px)]")}>
              {seat.name}
            </span>
            <span className={cn("font-sans text-muted", dense ? "text-[clamp(13px,1.5vw,18px)]" : "text-[clamp(15px,1.8vw,22px)]")}>
              {chairWord(seat, slot)}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  const numeral =
    chairs.length <= 2
      ? "text-[clamp(96px,16vw,220px)] lg:text-[clamp(120px,13vw,240px)]"
      : "text-[clamp(64px,11vw,150px)] lg:text-[clamp(80px,9vw,170px)]";

  return (
    <ol className={cn("grid gap-x-6 gap-y-8 lg:gap-x-10", chairs.length <= 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
      {chairs.map(({ seat, slot }) => (
        <li key={seat.id} className={cn("min-w-0", !seat.active && "opacity-40")}>
          <span className={cn("numeral block leading-none", numeral, slot ? "text-strong" : "text-white/40")}>
            {slot ? slot.number : "—"}
          </span>
          <span className="mt-3 block truncate font-sans text-[clamp(18px,2.2vw,30px)] leading-tight text-strong">
            {seat.name}
          </span>
          <span className="mt-1 block truncate font-sans text-[clamp(14px,1.5vw,20px)] leading-tight text-muted">
            {chairWord(seat, slot)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** "with Ade", "free" or "closed today": the line under a chair's name. */
function chairWord(seat: PublicSeat, slot: ServingSlot | null): string {
  if (!seat.active) return "closed today";
  if (slot) return seat.workerName ? `with ${seat.workerName}` : "being served";
  return "free";
}

/**
 * The three numbers after the counter, fading back. The third is 40% rather
 * than the handoff's 30%: at 30% over #111 it lands at 2.6:1, under the 3:1
 * that even large text has to clear.
 */
const upNextClasses = [
  "numeral text-[clamp(44px,7vw,80px)] text-white",
  "numeral text-[clamp(36px,5.6vw,64px)] text-white/55",
  "numeral text-[clamp(30px,4.8vw,52px)] text-white/40",
] as const;

function statusSuffix(status: QueueStatus): string {
  switch (status) {
    case "PAUSED":
      return " · Paused";
    case "CLOSED":
      return " · Closed";
    default:
      return "";
  }
}

function JoinCode({
  origin,
  state,
}: {
  origin: string;
  state: PublicState;
}): JSX.Element {
  // Sized as a square before the origin is known, so the board does not reflow
  // around the code the moment it appears.
  return (
    <div className="aspect-square w-full max-w-[220px] rounded-[16px] bg-white p-3 sm:max-w-[clamp(220px,22vw,380px)]">
      {origin && (
        <QrCode
          value={`${origin}/q/${state.queue.slug}`}
          label={`QR code to join the queue at ${state.queue.name}`}
          className="h-full"
        />
      )}
    </div>
  );
}

/**
 * The board keeps the dark shell whichever theme the browser holds.
 *
 * Every other screen follows the theme because a person chose it on their own
 * device. Nobody chooses anything on a screen bolted to a wall: it is a
 * departure board, and white numerals on near-black is what carries a number
 * across a room without glare. The QR stays dark-on-white regardless, as it
 * does everywhere.
 */
function Frame({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div data-surface="display" className="min-h-dvh bg-shell">
      <main className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] lg:px-11 lg:pb-[max(2.75rem,env(safe-area-inset-bottom))] lg:pt-[max(2.75rem,env(safe-area-inset-top))]">
        {children}
      </main>
    </div>
  );
}
