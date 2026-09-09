"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { ChevronRight } from "lucide-react";
import { Icon } from "@/components/Icon";
import { LinkButton } from "@/components/LinkButton";
import { minutesSince, useNow } from "@/hooks/useNow";
import { workerName, type Chair } from "@/lib/seats";
import { cn } from "@/lib/utils";

interface ChairRailProps {
  chairs: Chair[];
  openSeatId: string | null;
  /** Whether this person may open a tile. Staff may open only their own. */
  canOpen: (chair: Chair) => boolean;
  onOpen: (seatId: string) => void;
  /** The All chairs page, for whoever may see every chair. */
  allChairsHref?: string;
}

/**
 * Every chair as a small tile in one row that never wraps. Ten fit on a
 * desktop and the rest scroll sideways behind a fade; the open chair's tile
 * is kept in view. A tile is the chair's name, who works it, the number and
 * one word of state — vermilion on the number only when somebody has been
 * called there, which is the same rule as the card.
 */
export function ChairRail({
  chairs,
  openSeatId,
  canOpen,
  onOpen,
  allChairsHref,
}: ChairRailProps): JSX.Element {
  const now = useNow();
  const scroller = useRef<HTMLUListElement>(null);
  const tiles = useRef(new Map<string, HTMLElement>());
  const [overflowing, setOverflowing] = useState(false);

  // Whether there is more than fits, so the header can say so: a tablet has
  // no scrollbar to show it.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = (): void =>
      setOverflowing(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [chairs.length]);

  useEffect(() => {
    if (!openSeatId) return;
    tiles.current
      .get(openSeatId)
      ?.scrollIntoView({
        inline: "nearest",
        block: "nearest",
        behavior: "smooth",
      });
  }, [openSeatId]);

  const open = chairs.filter((chair) => chair.seat.active).length;

  return (
    <section aria-labelledby="chairs-heading" className="min-w-0">
      <div className="flex items-center justify-between gap-4">
        <h3 id="chairs-heading" className="text-[12.5px] text-muted">
          Chairs · {open} of {chairs.length} open
          {overflowing && (
            <span className="text-faint"> · scroll for more</span>
          )}
        </h3>
        {allChairsHref && (
          <LinkButton href={allChairsHref} variant="ghost" size="sm">
            All chairs
            <Icon icon={ChevronRight} size={14} />
          </LinkButton>
        )}
      </div>

      <ul
        ref={scroller}
        className={cn(
          "-mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          overflowing &&
            "[mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-28px),transparent)]",
        )}
      >
        {chairs.map((chair) => {
          const { seat, entry, state } = chair;
          const isOpen = seat.id === openSeatId;
          const openable = canOpen(chair);
          const word =
            state === "serving" && entry?.servedAt
              ? `Serving · ${minutesSince(entry.servedAt, now)} min`
              : state === "called" && entry?.startedAt
                ? `Called · ${minutesSince(entry.startedAt, now)} min`
                : state === "ready"
                  ? "Ready"
                  : state === "unstaffed"
                    ? "Open"
                    : "Closed";

          return (
            <li
              key={seat.id}
              ref={(element) => {
                if (element) tiles.current.set(seat.id, element);
                else tiles.current.delete(seat.id);
              }}
              className="shrink-0 snap-start"
            >
              <button
                type="button"
                aria-pressed={isOpen}
                aria-disabled={!openable || undefined}
                aria-label={`${seat.name}, ${workerName(seat)}, ${entry ? `number ${entry.number}, ` : ""}${word}`}
                onClick={() => {
                  if (openable) onOpen(seat.id);
                }}
                className={cn(
                  "flex h-full w-[132px] flex-col rounded-[12px] border px-3 py-2.5 text-left transition-colors pointer-coarse:min-h-11",
                  isOpen ? "border-strong bg-shell-mid" : "border-shell-line",
                  openable &&
                    !isOpen &&
                    "hover:border-faint hover:bg-shell-mid",
                  !openable && "cursor-default",
                  state === "closed" && "opacity-50",
                )}
              >
                <span className="truncate text-[12px] text-dim">
                  <span className="font-medium text-strong">{seat.name}</span>
                  {" · "}
                  {workerName(seat)}
                </span>
                <span
                  className={cn(
                    "numeral mt-1 text-[28px] leading-none",
                    state === "called" || state === "serving"
                      ? "text-signal"
                      : state === "ready"
                        ? "text-strong"
                        : "text-faint",
                  )}
                >
                  {entry ? entry.number : "—"}
                </span>
                <span
                  className="mt-1 truncate text-[11.5px] text-muted"
                  suppressHydrationWarning
                >
                  {word}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
