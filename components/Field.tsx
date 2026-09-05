import type { InputHTMLAttributes, JSX, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  suffix?: string;
  /**
   * Sets the value in mono. For codes: a recovery code is transcribed
   * character by character, and the reading face is not drawn for telling O
   * from 0.
   */
  mono?: boolean;
}

/**
 * A labelled input: label above, hint or error below, one 44px control.
 *
 * Errors are carried by an outline and text, never by the signal colour —
 * vermilion means "being called" and nothing else.
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
      <label htmlFor={id} className="block text-[13px] font-medium text-dim">
        {label}
      </label>

      <div className="relative mt-1.5">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            "h-11 w-full rounded-[10px] border bg-shell-soft px-3.5 text-strong",
            mono ? "font-mono text-[16px] uppercase tracking-[0.08em]" : "text-[15px] pointer-coarse:text-[16px]",
            "placeholder:normal-case placeholder:tracking-normal placeholder:text-muted",
            "transition-[border-color,box-shadow] duration-150",
            // Focus is the border going to ink with a soft halo behind it,
            // rather than the page's outline ring: on a field the ring drew a
            // second line a hair outside the first. Plain :focus, since a text
            // field shows its focus however it was reached.
            "focus:outline-none focus:shadow-[0_0_0_3px_var(--shell-mid)]",
            // A field's outline is the only thing that says a field is there —
            // its fill and the page behind it are the same colour — so it
            // carries the palette's boundary tone rather than the row hairline.
            error
              ? "border-strong"
              : "border-faint hover:border-muted focus:border-strong",
            suffix && "pr-20",
          )}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] text-muted">
            {suffix}
          </span>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-[12.5px] font-medium text-strong">
          {error}
        </p>
      )}
    </div>
  );
}
