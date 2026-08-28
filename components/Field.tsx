import type { InputHTMLAttributes, JSX, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  suffix?: string;
  /**
   * Sets the value in mono rather than serif. For codes: a recovery code is
   * transcribed character by character, and the serif face is drawn for names
   * and numerals, not for telling O from 0.
   */
  mono?: boolean;
}

/**
 * A labelled input in the ticket language: mono label above, the value itself
 * set in serif so what the customer types reads like it belongs on the ticket.
 *
 * Errors are carried by an outline and text, never by the signal colour —
 * vermilion means "your turn" and nothing else.
 */
export function Field({
  label,
  hint,
  error,
  suffix,
  mono = false,
  className,
  ...props
}: FieldProps): JSX.Element {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted"
      >
        {label}
      </label>

      <div className="relative mt-2">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            "h-14 w-full rounded-[var(--radius-control)] border bg-shell-soft px-4",
            mono
              ? "font-mono text-[18px] uppercase tracking-[0.14em] text-strong"
              : "font-serif text-[28px] text-strong",
            "placeholder:font-mono placeholder:text-[13px] placeholder:uppercase placeholder:tracking-[0.16em] placeholder:text-muted",
            "transition-colors duration-150",
            // A field's outline is the only thing that says a field is there —
            // its fill and the page behind it are a tenth of a stop apart — so
            // it carries the palette's quietest legible tone rather than the
            // hairline the row separators use, which is invisible against the
            // shell at 1.4:1.
            error
              ? "border-strong"
              : "border-faint hover:border-muted focus-visible:border-strong",
            suffix && "pr-24",
          )}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            {suffix}
          </span>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className="mt-2 font-mono text-[11px] leading-relaxed text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-strong"
        >
          {error}
        </p>
      )}
    </div>
  );
}

