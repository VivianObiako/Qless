import type { JSX } from "react";
import type { Metadata } from "next";
import { EnterCodeForm } from "./EnterCodeForm";
import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "Enter your code",
};

export default function EnterPage(): JSX.Element {
  return (
    <div className="min-h-dvh bg-shell">
      {/* Dropped at print: recovery rotates the code, and the replacement sheet
          this page can produce carries its own masthead. */}
      <header className="border-b border-shell-mid print:hidden">
        <div className="mx-auto max-w-xl px-6 py-5">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-6 pb-24 pt-12">
        <EnterCodeForm />
      </main>
    </div>
  );
}
