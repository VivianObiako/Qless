import type { JSX } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { handoffConfig, handoffInitScript } from "@/lib/handoff";
import { reelInitScript } from "@/lib/reel";
import { DEFAULT_PREFERENCE, resolveTheme, themeInitScript } from "@/lib/theme";
import "./globals.css";

// Everything: numerals, names, headings, body and controls. Two weights, and
// nothing in the product goes heavier than 500.
const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist",
  display: "swap",
});

// Codes and slugs only — the things a person transcribes.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  display: "swap",
});

const DESCRIPTION =
  "Scan the code, take your number, and go and live your life. Your place is held and your phone tells you when to come back.";

export const metadata: Metadata = {
  // Link previews need absolute image URLs; each deployment names its own address.
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  title: {
    default: "Less Queues — Take back your time",
    template: "%s · Less Queues",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Less Queues",
    title: "Less Queues — Take back your time",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  // Operator dashboard links carry the owner token in the query string. Never
  // hand that to another origin through a Referer header.
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the notch and the home indicator; the screens pad with the
  // safe-area insets themselves.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Set per deployment: the old addresses that hand their visitors over to this one.
const handoff = handoffConfig(process.env.SITE_URL, process.env.LEGACY_HOSTS);

export default function RootLayout({ children }: LayoutProps<"/">): JSX.Element {
  return (
    <html
      lang="en"
      data-theme={resolveTheme(DEFAULT_PREFERENCE)}
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* First, so an old address moves on before anything paints. */}
        {handoff && <script dangerouslySetInnerHTML={{ __html: handoffInitScript(handoff) }} />}
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
