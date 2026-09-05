import type { JSX } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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
  // Draw under the notch and the home indicator; the screens pad with the
  // safe-area insets themselves.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">): JSX.Element {
  return (
    <html
      lang="en"
      data-theme={resolveTheme(DEFAULT_PREFERENCE)}
      className={`${geist.variable} ${geistMono.variable}`}
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
