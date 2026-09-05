import { useId, type JSX } from "react";

interface MarkProps {
  /** Rendered size in px. 22 beside the wordmark, 26 on the print sheet. */
  size: number;
  className?: string;
}

/** The stub: a tile with a bite out of each side. */
const TILE = "M18 4h28a12 12 0 0 1 12 12v32a12 12 0 0 1-12 12H18A12 12 0 0 1 6 48V16A12 12 0 0 1 18 4Z";

/**
 * The Qless mark: a ticket stub with a Q punched out of it.
 *
 * The tile is the only thing drawn. The bites at its sides and the letter in
 * its centre are cut through a mask, so the mark is one colour, follows
 * currentColor, and sits on any ground with nothing left outside its edge.
 * The same shape is the favicon and the home-screen icon.
 */
export function Mark({ size, className }: MarkProps): JSX.Element {
  // Several marks can share a page — the header, the ticket's back — and a
  // mask is addressed by id, so each instance cuts with its own.
  const maskId = useId();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
    >
      <mask id={maskId}>
        <rect width="64" height="64" fill="#fff" />
        <circle cx="6" cy="32" r="6.5" fill="#000" />
        <circle cx="58" cy="32" r="6.5" fill="#000" />
        <circle cx="32" cy="32" r="13.5" fill="#000" />
        <circle cx="32" cy="32" r="7" fill="#fff" />
        <path
          d="M39.5 39.5l7.5 7.5"
          stroke="#000"
          strokeWidth="6.5"
          strokeLinecap="round"
          fill="none"
        />
      </mask>
      <path fill="currentColor" d={TILE} mask={`url(#${maskId})`} />
    </svg>
  );
}
