import type { MetadataRoute } from "next";

/**
 * Lets the counter and the wall display be added to a home screen and opened
 * without browser chrome. Standalone rather than fullscreen: the display
 * wants the whole screen, but an operator still needs the system bar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Qless",
    short_name: "Qless",
    description: "A virtual queue. Scan the code, take a number, walk away.",
    start_url: "/queues",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
