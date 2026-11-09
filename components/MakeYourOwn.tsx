import type { JSX } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** The line on a customer's screen that tells a business they can have this too. */
export function MakeYourOwn({ className }: { className?: string }): JSX.Element {
  return (
    <p className={cn("text-center text-[12.5px] leading-[1.55] text-muted", className)}>
      Run a shop, clinic or event?{" "}
      <Link href="/create" className="font-medium text-strong underline underline-offset-4">
        Make your own queue, free
      </Link>
    </p>
  );
}
