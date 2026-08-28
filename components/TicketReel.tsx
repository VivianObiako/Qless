"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from "react";
import { HeroTicket } from "./HeroTicket";
import { MonoLabel } from "./Label";
import { TicketCard } from "./TicketCard";
import { REEL_ATTR } from "@/lib/reel";
import { cn } from "@/lib/utils";

/** One step per ticket. Four tear off, the fifth is the one that stays. */
const STEP_MS = 260;
const ADVANCE_MS = STEP_MS * 4;
const HOLD_MS = 160;
const MORPH_MS = 780;
const CROSSFADE_LEAD_MS = 140;

const TEARING_NUMBERS = [24, 23, 22, 21];

type Phase = "reel" | "morph" | "gone";

// The height sync has to happen before paint or the strip visibly resettles on
// the first frame. useLayoutEffect is a no-op during SSR, so alias it there.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The landing page's load sequence.
 *
 * A strip of tickets feeds past, each tearing off at its perforation and
 * falling away, until one is left standing. That last ticket is showing its
 * back — "No more waiting." — and as it travels into the hero's slot it turns
 * over on its own axis to reveal the front: the live hero ticket.
 *
 * The two faces are the same component at the same width and height, and the
 * height is measured from the real hero card at layout time. So the card only
 * ever translates and rotates; nothing scales, so no text distorts or reflows
 * mid-flight, and when the reel unmounts the card underneath is identical.
 */
export function TicketReel(): JSX.Element | null {
  const [phase, setPhase] = useState<Phase>("reel");
  const finalTicketRef = useRef<HTMLDivElement>(null);
  const flipperRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Match the strip's height to the hero ticket it is going to become. The
  // hero card's height depends on how its copy wraps, so measuring beats
  // hardcoding — and without this the morph would land with a visible jump.
  useIsomorphicLayoutEffect(() => {
    const hero = document.getElementById("hero-ticket");
    const strip = stripRef.current;
    if (!hero || !strip) return;
    strip.style.height = `${hero.getBoundingClientRect().height}px`;
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const timers: number[] = [];

    const finish = (): void => {
      for (const timer of timers) window.clearTimeout(timer);
      root.removeAttribute(REEL_ATTR);
      setPhase("gone");
    };

    // A preloader with the motion taken out is just a delay. Skip it outright.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.removeAttribute(REEL_ATTR);
      timers.push(window.setTimeout(() => setPhase("gone"), 0));
      return () => {
        for (const timer of timers) window.clearTimeout(timer);
      };
    }

    // The strip has finished advancing: fly the last ticket into the hero's
    // place and let the landing's own entrance start behind it.
    timers.push(
      window.setTimeout(() => {
        const ticket = finalTicketRef.current;
        const flipper = flipperRef.current;
        const hero = document.getElementById("hero-ticket");

        if (ticket && hero) {
          const from = ticket.getBoundingClientRect();
          const to = hero.getBoundingClientRect();
          ticket.style.transition = `transform ${MORPH_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`;
          ticket.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px)`;
        }

        // The turn itself. Slightly slower than the travel and eased both
        // ends, so the card reads as being turned over rather than spun.
        if (flipper) {
          flipper.style.transition = `transform ${MORPH_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
          flipper.style.transform = "rotateY(0deg)";
        }

        root.setAttribute(REEL_ATTR, "landing");
        setPhase("morph");
      }, ADVANCE_MS + HOLD_MS),
    );

    // Hand over just before the ticket lands, so the two crossfade rather than
    // swapping in a single frame.
    timers.push(
      window.setTimeout(
        () => root.removeAttribute(REEL_ATTR),
        ADVANCE_MS + HOLD_MS + MORPH_MS - CROSSFADE_LEAD_MS,
      ),
    );

    timers.push(
      window.setTimeout(() => setPhase("gone"), ADVANCE_MS + HOLD_MS + MORPH_MS + 120),
    );

    // Anyone who has seen it once can get past it immediately.
    window.addEventListener("keydown", finish, { once: true });
    window.addEventListener("pointerdown", finish, { once: true });

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      window.removeEventListener("keydown", finish);
      window.removeEventListener("pointerdown", finish);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      ref={overlayRef}
      // Decorative: the real landing is in the DOM underneath from the first
      // paint, so assistive technology never waits for this.
      aria-hidden="true"
      className={cn(
        "reel-overlay fixed inset-0 z-50 overflow-hidden",
        phase === "morph" && "pointer-events-none",
      )}
      style={{ "--reel-w": "min(360px, calc(100vw - 48px))" } as CSSProperties}
    >
      <div
        className={cn(
          "absolute inset-0 bg-shell transition-opacity ease-out",
          phase === "morph" ? "opacity-0" : "opacity-100",
        )}
        style={{ transitionDuration: `${MORPH_MS}ms` }}
      />

      <div className="absolute left-1/2 top-1/2 -translate-y-1/2">
        <div
          ref={stripRef}
          className="animate-reel-advance flex items-stretch"
          style={
            {
              marginLeft: "calc(var(--reel-w) / -2)",
              "--reel-step": "var(--reel-w)",
            } as CSSProperties
          }
        >
          {TEARING_NUMBERS.map((number, index) => (
            <StubTicket key={number} number={number} index={index} />
          ))}

          {/* The card that turns over. Its back is the reel's sign-off; its
              front is the hero ticket the landing page is about to show. */}
          <div
            ref={finalTicketRef}
            className="relative shrink-0"
            style={{ width: "var(--reel-w)", perspective: "1600px" }}
          >
            <div
              ref={flipperRef}
              className="relative h-full [transform-style:preserve-3d]"
              style={{ transform: "rotateY(180deg)" }}
            >
              <div className="h-full [backface-visibility:hidden]">
                <HeroTicket mode="hero" />
              </div>
              <div
                className="absolute inset-0 [backface-visibility:hidden]"
                style={{ transform: "rotateY(180deg)" }}
              >
                <HeroTicket mode="reel" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One of the tickets that tears off. */
function StubTicket({ number, index }: { number: number; index: number }): JSX.Element {
  return (
    <div
      className="animate-ticket-tear relative shrink-0"
      style={{
        width: "var(--reel-w)",
        animationDelay: `${index * STEP_MS + 130}ms`,
      }}
    >
      <TicketCard className="flex h-full w-full flex-col justify-between p-[22px]">
        <div className="flex items-start justify-between">
          <MonoLabel size={10} tone="paper">
            Qless pass
          </MonoLabel>
          <MonoLabel size={10} tone="paper">
            Waiting
          </MonoLabel>
        </div>
        <p className="numeral text-[96px] text-paper-ink">{number}</p>
      </TicketCard>

      {/* The seam: a dashed tear line with a notch bitten from each edge —
          the same perforation detail the product uses everywhere else. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 right-0 w-px border-l border-dashed border-paper-line"
      />
      <span
        aria-hidden="true"
        className="absolute -top-3 right-0 size-6 translate-x-1/2 rounded-full bg-shell"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-0 size-6 translate-x-1/2 rounded-full bg-shell"
      />
    </div>
  );
}

