"use client";

import type { JSX } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { cn } from "@/lib/utils";

interface QrCodeProps {
  /** The URL a customer's camera should land on. */
  value: string;
  /** Bitmap size in px. The canvas is scaled by CSS, so this is print
   *  resolution, not display size: 512 on screen, more for a printed sheet. */
  size?: number;
  label: string;
  /** Set this to make the code downloadable with downloadQrPng. */
  id?: string;
  className?: string;
}

// Dark on white, always — never the page's own colours.
//
// A QR code is a thing a stranger's camera has to read, sometimes off a screen
// at an angle in a badly lit shop. Tinting it to match the ticket, or letting
// it invert with the theme, trades scans for taste. It stays a printed label
// on a white field on every surface in the product.
const modules = "#111111";
const field = "#ffffff";

export function QrCode({ value, size = 512, label, id, className }: QrCodeProps): JSX.Element {
  return (
    <div id={id} className={cn("rounded-[var(--radius-control)] bg-white p-3", className)}>
      <QRCodeCanvas
        value={value}
        size={size}
        fgColor={modules}
        bgColor={field}
        // Error correction M survives a thumbprint or a curled poster corner
        // without inflating the pattern the way H would.
        level="M"
        // The wrapper's white padding is the quiet zone, so the bitmap itself
        // does not need to carry one.
        marginSize={0}
        role="img"
        aria-label={label}
        // qrcode.react writes the bitmap size onto the element as an inline
        // style, which a class cannot outrank — so the display size has to be
        // set the same way.
        style={{ display: "block", width: "100%", height: "auto" }}
      />
    </div>
  );
}

// The quiet zone the spec asks for is four modules. On screen it is the
// wrapper's white padding, which a downloaded bitmap does not come with — so
// the export adds its own. 12% of the width is four modules at the versions a
// queue URL produces, and being generous costs nothing on a poster.
const quietZone = 0.12;

/**
 * Saves a rendered code as the PNG an operator actually wants: something to
 * drop into a poster, a WhatsApp message, or a sign in the shop window.
 *
 * The canvas is found in the DOM at click time rather than held in a ref,
 * because that is genuinely when it is needed — and it keeps the component a
 * plain rendering of a value.
 *
 * It is re-drawn onto a white field rather than exported directly. A bare
 * bitmap dropped onto a coloured background is a code with no quiet zone, and
 * that is a code a phone at arm's length gives up on.
 */
export function downloadQrPng(id: string, filename: string): boolean {
  const canvas = document.getElementById(id)?.querySelector("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) return false;

  try {
    const margin = Math.round(canvas.width * quietZone);
    const sheet = document.createElement("canvas");
    sheet.width = canvas.width + margin * 2;
    sheet.height = canvas.height + margin * 2;

    const context = sheet.getContext("2d");
    if (!context) return false;

    context.fillStyle = field;
    context.fillRect(0, 0, sheet.width, sheet.height);
    context.drawImage(canvas, margin, margin);

    const link = document.createElement("a");
    link.href = sheet.toDataURL("image/png");
    link.download = filename;
    link.click();
    return true;
  } catch {
    return false;
  }
}

