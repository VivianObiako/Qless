import type { JSX, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * quiet    — informational, sits back
 * standing — the state the customer needs to act on; solid outline, full contrast
 * onPaper  — the same, on an inverted paper shell
 */
type NoticeTone = "quiet" | "standing" | "onPaper";

interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  /** The 24px chip that opens the reassurance row. */
  chip?: string;
  className?: string;
}

const toneClasses: Record<NoticeTone, string> = {
  quiet: "border-shell-line bg-shell-soft text-muted",
  standing: "border-strong bg-shell-soft text-strong",
  onPaper: "border-paper-line bg-paper text-paper-ink",
};

const chipClasses: Record<NoticeTone, string> = {
  quiet: "bg-shell-mid text-dim",
  standing: "bg-strong text-shell",
  onPaper: "bg-paper-ink text-paper",
};

/**
 * The shared shape for reassurance, paused, closed, full and error messages.
 *
 * Deliberately monochrome: the direction reserves its one colour for a person
 * being called, so weight and inversion carry urgency here instead of hue.
 */
export function Notice({
  tone = "quiet",
  title,
  children,
  action,
  chip,
  className,
}: NoticeProps): JSX.Element {
  return (
    <div
      className={cn("flex gap-3 rounded-[12px] border px-4 py-3.5", toneClasses[tone], className)}
    >
      {chip && (
        <span
          aria-hidden="true"
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-medium",
            chipClasses[tone],
          )}
        >
          {chip}
        </span>
      )}

      <div className="min-w-0 flex-1">
        {title && <p className="text-[13.5px] font-medium">{title}</p>}
        {children && (
          <div
            className={cn(
              "text-[13.5px] leading-[1.55]",
              title && "mt-1",
              tone === "standing" && "text-dim",
            )}
          >
            {children}
          </div>
        )}
        {action && <div className="mt-3.5">{action}</div>}
      </div>
    </div>
  );
}
