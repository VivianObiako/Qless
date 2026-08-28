import type { JSX } from "react";
import { MonoLabel } from "./Label";
import { Perforation, TicketBadge, TicketCard } from "./TicketCard";
import { cn } from "@/lib/utils";

/**
 * The ticket shown on the landing page, and the one the load reel resolves
 * into.
 *
 * Both modes render inside the same frame at the same height, which is what
 * lets the reel's final ticket travel into the hero's position as a pure
 * translate — no scaling, so nothing distorts and no text reflows mid-flight.
 * Only the printed content crossfades at the end.
 */
type HeroTicketMode = "hero" | "reel";

interface HeroTicketProps {
  mode?: HeroTicketMode;
  id?: string;
  className?: string;
}

export function HeroTicket({ mode = "hero", id, className }: HeroTicketProps): JSX.Element {
  return (
    <TicketCard
      id={id}
      className={cn(
        "flex min-h-[236px] w-full flex-col p-[22px] transition-opacity duration-200",
        className,
      )}
    >
      {mode === "hero" ? <HeroFace /> : <ReelFace />}
    </TicketCard>
  );
}

function HeroFace(): JSX.Element {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="font-serif text-[24px] leading-none text-paper-ink">
          Ade&rsquo;s Barbershop
        </p>
        <TicketBadge>In queue</TicketBadge>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <MonoLabel size={10} tone="paper">
            Your no.
          </MonoLabel>
          <p className="numeral mt-2 text-[76px] text-paper-ink">21</p>
        </div>
        <div className="pb-2 text-right">
          <MonoLabel size={10} tone="paper">
            Est. wait
          </MonoLabel>
          <p className="numeral mt-1.5 text-[28px] text-paper-ink">25–35 min</p>
        </div>
      </div>

      <Perforation className="-mx-[22px] my-5" />

      <p className="font-mono text-[11px] leading-[1.7] text-paper-muted">
        This is the whole product. There is no second screen to learn.
      </p>
    </>
  );
}

/** The last ticket on the strip — the one that does not tear off. */
function ReelFace(): JSX.Element {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-[22px] shrink-0 place-items-center rounded-[var(--radius-control)] bg-paper-ink"
          >
            <span className="font-serif text-[14px] leading-none text-paper">Q</span>
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-paper-ink">
            Qless
          </span>
        </span>
        <TicketBadge>Admit one</TicketBadge>
      </div>

      <div className="mt-auto">
        <Perforation className="-mx-[22px] mb-5" />
        <p className="font-serif text-[38px] leading-[1.05] text-paper-ink">No more waiting.</p>
      </div>
    </>
  );
}
