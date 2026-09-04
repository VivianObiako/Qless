import type { JSX } from "react";
import Link from "next/link";
import { HeroTicketStage } from "@/components/HeroTicketStage";
import { MonoLabel } from "@/components/Label";
import { MyQueuesLink } from "@/components/MyQueuesLink";
import { SmoothScroll } from "@/components/SmoothScroll";
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
    <div className="min-h-dvh bg-shell">
      <SmoothScroll />

      <header className="border-b border-shell-mid">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
          <Wordmark asLink={false} />

          <div className="flex items-center gap-6">
            <a
              href="#how-it-works"
              className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-strong sm:inline"
            >
              How it works
            </a>
            {/* Only ever rendered for a browser that already holds a session,
                and only once the client is running — see MyQueuesLink. */}
            <MyQueuesLink className="hidden sm:inline" />
            {/* The labelled pill does not fit beside the wordmark and the CTA
                on a phone, so the mark goes alone rather than going missing —
                a visitor on a phone still gets to choose the theme. */}
            <ThemeToggle variant="quiet" className="sm:hidden" />
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link
              href="/create"
              className="rounded-(--radius-control) bg-strong px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-shell transition-opacity hover:opacity-90 active:scale-[0.99]"
            >
              Create a queue
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-14 px-6 py-16 lg:grid-cols-[1fr_360px] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <h1 className="animate-reveal font-sans text-[clamp(56px,11vw,104px)] leading-[0.92] tracking-[-0.035em] text-strong">
              Stop waiting
              <div className="mt-2" />
              in line.
            </h1>

            <p
              className="animate-reveal mt-7 max-w-115 font-mono text-[15px] leading-[1.7] text-dim"
              style={{ animationDelay: "90ms" }}
            >
              Scan the code, take your number, and go and live your life. Your place is held and
              your phone tells you when to come back.
            </p>

            <div
              className="animate-reveal mt-9 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "180ms" }}
            >
              <Link
                href="/create"
                className="rounded-(--radius-control) bg-strong px-5 py-3.75 font-mono text-[11px] uppercase tracking-[0.18em] text-shell transition-[opacity,transform] hover:opacity-90 active:scale-[0.99]"
              >
                Create a queue
              </Link>
              {/* <a
                href="#how-it-works"
                className="rounded-(--radius-control) border border-shell-line px-5 py-3.75 font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-[color,border-color,transform] hover:border-strong hover:text-strong active:scale-[0.99]"
              >
                See how it works
              </a> */}
              <a
                href="/enter"
                className="rounded-(--radius-control) border border-shell-line px-5 py-3.75 font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-[color,border-color,transform] hover:border-strong hover:text-strong active:scale-[0.99]"
              >
                I have a code
              </a>
            </div>

            <div
              className="animate-reveal mt-7 flex flex-wrap items-center gap-x-5 gap-y-2"
              style={{ animationDelay: "260ms" }}
            >
              <MonoLabel size={10} tone="muted">
                No app · No account · Free to try
              </MonoLabel>
              {/* Coming back on a new phone is not an error state, so the way
                  in sits on the front door rather than behind one. */}
              {/* <Link
                href="/enter"
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted underline underline-offset-4 transition-colors hover:text-strong"
              >
                I have a code
              </Link> */}
            </div>
          </div>

          {/* The product itself above the fold, built from the same primitives
              the customer sees — not a picture of it. Capped below lg: a ticket
              is a held object, and stretching it to the full column width makes
              it read as a banner instead. */}
          <div className="max-w-90 lg:w-90 justify-self-center lg:justify-self-end">
            <HeroTicketStage id="hero-ticket" />
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className="scroll-mt-8 border-t border-shell-mid"
        >
          {/* The five steps are the section's whole content and read as a
              heading to anybody who can see them. A screen reader jumping
              between landmarks gets nothing without this. */}
          <h2 id="how-it-works-heading" className="sr-only">
            How it works
          </h2>

          <ol className="mx-auto grid max-w-6xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, index) => {
              // Step 05 is the second and last place vermilion appears in the
              // entire product. It is the promise the whole thing is selling.
              const isFinal = index === steps.length - 1;

              return (
                <li
                  key={step.number}
                  className={cn(
                    "group border-shell-mid px-6 py-8 transition-colors duration-300 hover:bg-shell-soft motion-reduce:transition-none",
                    index > 0 && "border-t sm:border-t-0 lg:border-l",
                    index === 1 && "sm:border-l",
                    index === 2 && "sm:border-t lg:border-t-0",
                    index === 3 && "sm:border-l sm:border-t lg:border-t-0",
                    index === 4 && "sm:border-t lg:border-t-0",
                  )}
                >
                  <p
                    className={cn(
                      "numeral text-[28px]",
                      isFinal ? "text-signal" : "text-strong",
                    )}
                  >
                    {step.number}
                  </p>
                  {/* The numeral carries the vermilion and the label does not:
                      at 28px the signal clears the 3:1 large text needs, and at
                      10px it would need 4.5:1, which no vermilion light enough
                      to still read as vermilion can reach on either shell. */}
                  <MonoLabel size={10} tone="inherit" className="mt-3 block text-strong">
                    {step.title}
                  </MonoLabel>
                  <p className="mt-2.5 font-mono text-[11px] leading-[1.7] text-muted">
                    {step.detail}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </div>
  );
}

