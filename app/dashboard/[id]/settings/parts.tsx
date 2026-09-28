import type { JSX, ReactNode } from "react";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { cn } from "@/lib/utils";
import { MEASURE_SAMPLE, type ServiceMeasure } from "@/lib/types";

/** The save button and the error above it, drawn the same on every tab. */
export function SaveRow({ error, saving }: { error: string | null; saving: boolean }): JSX.Element {
  return (
    <>
      {error && (
        <Notice tone="standing" title="Couldn't save your changes" chip="!" className="mt-6">
          {error}
        </Notice>
      )}

      <div className="mt-8 flex flex-wrap gap-2 border-t border-shell-line pt-6">
        <Button type="submit" variant="contrast" size="md" loading={saving}>
          Save settings
        </Button>
      </div>
    </>
  );
}

/**
 * A labelled switch: the label and its explanation on the left, the control
 * on the right. Monochrome, as every control here is.
 */
export function Switch({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <label className={cn("flex items-start justify-between gap-4", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
      <span>
        <span className="block text-[14.5px] font-medium text-strong">{label}</span>
        {description && (
          <span className="mt-1 block text-[13px] leading-[1.6] text-muted">{description}</span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-faint transition-colors peer-checked:bg-strong peer-disabled:opacity-50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-strong after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-shell after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}

/**
 * One of a few, as a segmented row: the Appearance control on the profile,
 * drawn for a setting. The explanation of whichever option is chosen sits
 * under it, so the owner reads what the choice does rather than a label.
 */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; description: string }[];
  value: T;
  onChange: (value: T) => void;
}): JSX.Element {
  const chosen = options.find((option) => option.value === value);
  // An id cannot hold spaces: aria-labelledby reads a space as a list of ids.
  const labelId = `choice-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div>
      <span id={labelId} className="block text-[14.5px] font-medium text-strong">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="mt-2 grid max-w-sm grid-cols-2 gap-1 rounded-[10px] bg-shell-mid p-1"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-[8px] px-2 py-2 text-[13px] transition-colors pointer-coarse:min-h-11",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong",
                selected ? "bg-shell-soft font-medium text-strong" : "text-muted hover:text-strong",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {chosen && <p className="mt-2 text-[13px] leading-[1.6] text-muted">{chosen.description}</p>}
    </div>
  );
}

/**
 * The service-time hint says which figure the estimates are actually using,
 * so the number in the box is never mistaken for the number on the pass.
 * With more than one seat open it says the figure is per seat, because the
 * wait itself is divided by them.
 */
export function measuredHint(measured: ServiceMeasure, openSeats: number): string {
  const perSeat = openSeats > 1 ? ", per seat" : "";
  if (measured.sample >= MEASURE_SAMPLE) {
    return `Measured lately: ${measured.minutes} min across the last ${measured.sample} served${perSeat}. Estimates are using that figure, not this one.`;
  }
  if (measured.sample > 0) {
    return `Measured so far: ${measured.minutes} min across ${measured.sample} served${perSeat}. Estimates switch to the measured figure after ${MEASURE_SAMPLE}.`;
  }
  return "Used to estimate waits until the day has produced real service times.";
}

/**
 * A settings section as two columns: what it is and why on the left, the
 * fields on the right. Stacks on a phone.
 */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="grid gap-5 border-t border-shell-line py-7 first:border-t-0 first:pt-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div>
        <h3 className="text-[15px] font-medium text-strong">{title}</h3>
        <p className="mt-1 max-w-[30ch] text-[13px] leading-[1.55] text-muted">{description}</p>
      </div>
      <div className="flex max-w-lg flex-col gap-5">{children}</div>
    </section>
  );
}
