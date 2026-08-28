import type { JSX } from "react";

interface QMarkProps {
  /** Box the glyph is drawn into, in px. Sized relative to its parent chip. */
  size: number;
  className?: string;
}

/**
 * The glyph on the paper chip: a bold ring with a tail crossing it, drawn as
 * plain shapes rather than set in Instrument Serif. The same mark is the
 * favicon, where it has to survive down to 16px — a thin high-contrast serif
 * blurs to nothing at that size, and a tail thin enough to look elegant in
 * text disappears entirely. This is bold and geometric instead, and legible
 * from a browser tab up to the landing hero.
 *
 * Colour comes from currentColor, so it follows whatever text colour the
 * chip around it is using rather than carrying its own.
 */
export function QMark({ size, className }: QMarkProps): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M50 32A18 18 0 1 1 14 32A18 18 0 1 1 50 32Z
           M42 32A10 10 0 1 1 22 32A10 10 0 1 1 42 32Z"
        fill="currentColor"
      />
      <line x1="36" y1="36" x2="50" y2="50" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}
