import type { JSX } from "react";
import type { Metadata } from "next";
import { CreateQueueForm } from "./CreateQueueForm";
import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "Create a queue",
};

export default function CreateQueuePage(): JSX.Element {
  return (
    <div className="min-h-dvh bg-shell">
      {/* Dropped at print: the recovery sheet this page can produce carries its
          own masthead, and a nav bar is not part of the document. */}
      <header className="border-b border-shell-mid print:hidden">
        <div className="mx-auto max-w-xl px-6 py-5">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-6 pb-24 pt-12">
        <CreateQueueForm />
      </main>
    </div>
  );
}

