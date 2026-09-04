import type { JSX } from "react";
import Link from "next/link";
import { HeroTicketStage } from "@/components/HeroTicketStage";
import { LinkButton } from "@/components/LinkButton";
import { MyQueuesLink } from "@/components/MyQueuesLink";
import { SmoothScroll } from "@/components/SmoothScroll";
import { TicketReel } from "@/components/TicketReel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
import { cn } from "@/lib/utils";

interface Step {
  number: string;
  title: string;
  detail: string;
}

const steps: Step[] = [
  { number: "01", title: "Scan the code", detail: "On the door, the counter, the table." },
  { number: "02", title: "Give a name", detail: "Nothing else. No sign-up, no number." },
  { number: "03", title: "Walk away", detail: "Your place is held whether the tab is open or not." },
  { number: "04", title: "Get the nudge", detail: "Three away, one away, your turn." },
  { number: "05", title: "Walk straight in", detail: "The screen goes red. You're up." },
];

export default function LandingPage(): JSX.Element {
  return (
    // A viewport-high composition: the hero takes the room between the bar
    // and the steps, and the steps sit on the bottom edge. On a short window
    // it simply scrolls.
    <div className="flex min-h-dvh flex-col bg-shell">
      <TicketReel />
      <SmoothScroll />

      <header className="border-b border-shell-line">
        <nav className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-6 px-6 py-4 lg:px-10 xl:px-14">
          <Wordmark asLink={false} />

          <div className="flex items-center gap-5">
            <a
              href="#how-it-works"
              className="hidden text-[13.5px] text-dim transition-colors hover:text-strong sm:inline"
            >
              How it works
            </a>
            {/* Only ever rendered for a browser that already holds a session,
                and only once the client is running — see MyQueuesLink. */}
            <MyQueuesLink className="hidden sm:inline" />
            {/* The labelled pill does not fit beside the wordmark and the CTA
                on a phone, so the mark goes alone rather than going missing. */}
            <ThemeToggle variant="quiet" className="sm:hidden" />
            <ThemeToggle className="hidden sm:inline-flex" />
            <LinkButton href="/create" size="md">
              Create a queue
            </LinkButton>
          </div>
        </nav>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto grid w-full max-w-[1400px] flex-1 content-center gap-14 px-6 py-16 lg:grid-cols-[1fr_360px] lg:items-center lg:gap-16 lg:px-10 lg:py-20 xl:grid-cols-[1fr_420px] xl:px-14">
          <div>
            <h1 className="animate-reveal text-[clamp(56px,8.5vw,128px)] font-medium leading-[0.92] tracking-[-0.04em] text-strong">
              Stop waiting
              <div className="mt-2" />
              in line.
            </h1>

            <p
              className="animate-reveal mt-7 max-w-[46ch] text-[17px] leading-[1.6] text-dim"
              style={{ animationDelay: "90ms" }}
            >
              Scan the code, take your number, and go and live your life. Your place is held and
              your phone tells you when to come back.
            </p>

            <div
              className="animate-reveal mt-9 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "180ms" }}
            >
              <LinkButton href="/create">Create a queue</LinkButton>
              {/* Coming back on a new phone is not an error state, so the way
                  in sits on the front door rather than behind one. */}
              <LinkButton href="/enter" variant="ghost">
                I have a code
              </LinkButton>
            </div>

            <p
              className="animate-reveal mt-7 text-[13px] text-muted"
              style={{ animationDelay: "260ms" }}
            >
              No app · No account · Free to try
            </p>
          </div>

          {/* The product itself above the fold, built from the same primitives
              the customer sees — not a picture of it. Capped below lg: a ticket
              is a held object, and stretching it to the full column width makes
              it read as a banner instead. */}
          <div className="w-full max-w-90 justify-self-center lg:w-90 lg:justify-self-end xl:w-[420px] xl:max-w-[420px]">
            <HeroTicketStage id="hero-ticket" />
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className="mt-auto scroll-mt-8 border-t border-shell-line"
        >
          {/* The five steps are the section's whole content and read as a
              heading to anybody who can see them. A screen reader jumping
              between landmarks gets nothing without this. */}
          <h2 id="how-it-works-heading" className="sr-only">
            How it works
          </h2>

          <ol className="mx-auto grid w-full max-w-[1400px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 lg:px-4 xl:px-8">
            {steps.map((step, index) => {
              // Step 05 is the one place on this page the signal colour
              // appears. It is the promise the whole thing is selling.
              const isFinal = index === steps.length - 1;

              return (
                <li
                  key={step.number}
                  className={cn(
                    "group border-shell-line px-6 py-7 transition-colors duration-300 hover:bg-shell-mid motion-reduce:transition-none",
                    index > 0 && "border-t sm:border-t-0 lg:border-l",
                    index === 1 && "sm:border-l",
                    index === 2 && "sm:border-t lg:border-t-0",
                    index === 3 && "sm:border-l sm:border-t lg:border-t-0",
                    index === 4 && "sm:border-t lg:border-t-0",
                  )}
                >
                  <p className={cn("numeral text-[26px]", isFinal ? "text-signal" : "text-strong")}>
                    {step.number}
                  </p>
                  <p className="mt-3 text-[14.5px] font-medium text-strong">{step.title}</p>
                  <p className="mt-1.5 text-[13.5px] leading-[1.55] text-muted">{step.detail}</p>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </div>
  );
}
