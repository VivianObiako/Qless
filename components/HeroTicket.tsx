import type { JSX } from "react";
import { MonoLabel } from "./Label";
import { Mark } from "./Mark";
import { Perforation, TicketBadge, TicketCard } from "./TicketCard";
import { cn } from "@/lib/utils";

/**
 * The ticket shown on the landing page.
 *
 * Two faces in one frame: the front is the customer's pass as it really is,
 * and the back is the flourish a tap turns it over to. Both are laid out to
 * the same height so the turn is a pure rotation with nothing reflowing.
 */
type HeroTicketMode = "hero" | "back";

interface HeroTicketProps {
  mode?: HeroTicketMode;
  id?: string;
  className?: string;
}

export function HeroTicket({ mode = "hero", id, className }: HeroTicketProps): JSX.Element {
  return (
    <TicketCard
      id={id}
      className={cn("flex h-full w-full flex-col p-[22px] transition-opacity duration-200", className)}
    >
      {mode === "hero" ? <HeroFace /> : <BackFace />}
    </TicketCard>
  );
}

function HeroFace(): JSX.Element {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[22px] font-medium leading-none tracking-[-0.02em] text-paper-ink">
          Ade&rsquo;s Barbershop
        </p>
        <TicketBadge>In queue</TicketBadge>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <MonoLabel size={10} tone="paper">
            Your number
          </MonoLabel>
          <p className="numeral mt-2 text-[96px] text-paper-ink">21</p>
        </div>
        <div className="pb-1 text-right">
          <MonoLabel size={10} tone="paper">
            Estimated wait
          </MonoLabel>
          <p className="numeral mt-1.5 text-[30px] text-paper-ink">25–35 min</p>
        </div>
      </div>

      <Perforation className="-mx-[22px] my-5" />

      <p className="text-[13px] leading-[1.55] text-paper-muted">
        This is the whole product. There is no second screen to learn.
      </p>
    </>
  );
}

/** The back of the ticket: decorative, and drawn to the same height as the front. */
function BackFace(): JSX.Element {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-2.5">
          <Mark size={22} className="shrink-0 text-paper-ink" />
          <span className="text-[15px] font-medium tracking-[-0.01em] text-paper-ink">Qless</span>
        </span>
        <TicketBadge>Admit one</TicketBadge>
      </div>

      <div className="mt-auto">
        <Perforation className="-mx-[22px] mb-5" />
        <p className="text-[34px] font-medium leading-[1.05] tracking-[-0.03em] text-paper-ink">
          No more waiting.
        </p>
      </div>
    </>
  );
}
