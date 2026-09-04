"use client";

import { useCallback, useRef, useSyncExternalStore, type JSX, type PointerEvent } from "react";
import { HeroTicket } from "./HeroTicket";
import { cn } from "@/lib/utils";

/** How far the card leans when the cursor is at a corner, and how far it lifts. */
const MAX_TILT_DEG = 9;
const LIFT_PX = 16;

const TRACK_MS = 140;
const SETTLE_MS = 520;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(listener: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

interface HeroTicketStageProps {
  /** Goes on the outer frame, which never transforms. */
  id?: string;
  className?: string;
}

/**
 * The landing page's hero ticket, made to behave like a card someone is holding.
 *
 * A mouse tips it on two axes and lifts it towards the viewer. A tap turns it
 * over onto its back, "No more waiting." — a flourish drawn from the product's
 * own vocabulary rather than invented for the landing page.
 *
 * Transforms are written straight to the node instead of through state: a
 * pointer move fires far more often than a render is worth, and the position is
 * the browser's to own between frames.
 */
export function HeroTicketStage({ id, className }: HeroTicketStageProps): JSX.Element {
  const cardRef = useRef<HTMLDivElement>(null);
  const flipped = useRef(false);
  const reduced = usePrefersReducedMotion();

  const armed = useCallback((): boolean => !reduced, [reduced]);

  const paint = useCallback(
    (tiltX: number, tiltY: number, lift: number, durationMs: number): void => {
      const card = cardRef.current;
      if (!card) return;

      const turn = flipped.current ? 180 : 0;
      card.style.transition = `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      // translateZ leads so the lift is always towards the viewer rather than
      // along whichever axis the card has just been rotated onto.
      card.style.transform = `translateZ(${lift}px) rotateX(${tiltY}deg) rotateY(${turn + tiltX}deg)`;
    },
    [],
  );

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    // Tilt is a cursor affordance. A finger gets the flip instead, and dragging
    // one across the card should not leave it leaning.
    if (event.pointerType !== "mouse" || !armed()) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const fromCentreX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const fromCentreY = (event.clientY - bounds.top) / bounds.height - 0.5;

    paint(fromCentreX * 2 * MAX_TILT_DEG, -fromCentreY * 2 * MAX_TILT_DEG, LIFT_PX, TRACK_MS);
  }

  function onPointerLeave(): void {
    if (!armed()) return;
    paint(0, 0, 0, SETTLE_MS);
  }

  function onClick(): void {
    if (!armed()) return;
    flipped.current = !flipped.current;
    paint(0, 0, 0, SETTLE_MS);
  }

  return (
    <div
      id={id}
      className={cn("h-full [perspective:1400px]", className)}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
    >
      <div
        ref={cardRef}
        className={cn(
          "relative h-full [transform-style:preserve-3d] will-change-transform",
          !reduced && "cursor-pointer select-none",
        )}
      >
        <div className="h-full [backface-visibility:hidden]">
          <HeroTicket mode="hero" />
        </div>

        {/* The back of the card. Decorative — it carries no information the
            front does not, which is why turning it over is not offered as a
            control and nothing is lost by never finding it. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <HeroTicket mode="back" />
        </div>
      </div>
    </div>
  );
}
