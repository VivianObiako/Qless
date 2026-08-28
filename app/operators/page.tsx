import type { JSX } from "react";
import type { Metadata } from "next";
import { OperatorRoster } from "./OperatorRoster";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "Your team",
};

export default function OperatorsPage(): JSX.Element {
  return (
    <div className="min-h-dvh bg-shell">
      <header className="border-b border-shell-mid">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5">
          <Wordmark />
          <ThemeToggle variant="quiet" className="sm:hidden" />
          <ThemeToggle className="hidden sm:inline-flex" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <OperatorRoster />
      </main>
    </div>
  );
}
