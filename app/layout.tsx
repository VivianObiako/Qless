import type { JSX } from "react";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { reelInitScript } from "@/lib/reel";
import { DEFAULT_THEME, themeInitScript } from "@/lib/theme";
import "./globals.css";

// Numerals, venue names and headlines. One weight is all the direction uses.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
});

// Labels, UI, body and buttons.
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Qless — stop waiting in line",
    template: "%s · Qless",
  },
  description:
    "Scan the code, take your number, and go and live your life. Your place is held and your phone tells you when to come back.",
  // Operator dashboard links carry the owner token in the query string. Never
  // hand that to another origin through a Referer header.
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111111",
};

export default function RootLayout({ children }: LayoutProps<"/">): JSX.Element {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      className={`${instrumentSerif.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint, so the shell is never
            painted in the wrong colour and then corrected. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: reelInitScript }} />
      </head>
      <body>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
