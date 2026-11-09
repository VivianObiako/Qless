import type { JSX, ReactNode } from "react";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "Privacy",
};

const contactEmail = "vivianobiako@gmail.com";

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="mt-10">
      <h2 className="text-[18px] font-medium tracking-[-0.01em] text-strong">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.65] text-dim">{children}</div>
    </section>
  );
}

function List({ items }: { items: ReactNode[] }): JSX.Element {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-faint">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPage(): JSX.Element {
  return (
    <div className="min-h-dvh bg-shell">
      <header className="border-b border-shell-mid">
        <div className="mx-auto max-w-xl px-6 py-5">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-6 pb-24 pt-12">
        <h1 className="text-[clamp(30px,7vw,40px)] font-medium leading-none tracking-[-0.03em] text-strong">
          Privacy
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-dim">
          Less Queues holds your place in a line from your phone. We collect as little as we can to do that.
        </p>

        <Section title="If you join a queue">
          <List
            items={[
              "We store the name you type, your number in the line, and when you joined, were called and were served.",
              "We never ask for your phone number, your email or an account.",
              "If you allow alerts, your browser gives us an address to send them to. We delete it when your visit ends.",
              "The business running the queue and its staff see your name. Other customers only see numbers.",
            ]}
          />
        </Section>

        <Section title="If you run a queue">
          <List
            items={[
              "We store your queue’s name and settings, and your own name if you give it.",
              "Recovery codes and staff access codes are kept only in a scrambled form we cannot read back, which is why we cannot resend a lost code.",
            ]}
          />
        </Section>

        <Section title="On your device">
          <p>
            Your browser saves a small key so it remembers your place or your dashboard. Clearing your browser data
            removes it.
          </p>
        </Section>

        <Section title="What we don’t do">
          <p>We don’t sell or share your data, show ads, or track you across other sites.</p>
        </Section>

        <Section title="Where it lives">
          <List
            items={[
              "Our servers and database are in Frankfurt, Germany (Render and Neon). The website runs on Vercel.",
              "These companies may keep basic technical logs, including IP addresses, as part of running their services.",
              "To stop people flooding a queue, we hold IP addresses briefly in memory. We never save them.",
            ]}
          />
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep visit history for as long as the business keeps its queue, so they can look back at past days. To
            have your name removed, email us.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-strong underline underline-offset-4"
            >
              {contactEmail}
            </a>
          </p>
        </Section>

        <p className="mt-12 text-[13px] text-muted">Last updated 9 November 2026</p>
      </main>
    </div>
  );
}
