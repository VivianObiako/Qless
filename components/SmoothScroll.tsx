"use client";

import { useEffect, type JSX } from "react";
import Lenis from "lenis";

/**
 * Smooth scrolling, scoped to the landing page.
 *
 * It is deliberately not applied to the customer pass or the dashboard: those
 * are single-view operational screens where hijacking the scroll would fight
 * the user rather than flatter the page.
 *
 * Disabled outright under prefers-reduced-motion — smooth scroll is exactly the
 * kind of motion that setting exists to switch off.
 */
export function SmoothScroll(): JSX.Element | null {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (prefersReducedMotion.matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number): number => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Touch devices already have good native inertia; leave it alone.
      smoothWheel: true,
      syncTouch: false,
    });

    let frame = 0;
    const raf = (time: number): void => {
      lenis.raf(time);
      frame = window.requestAnimationFrame(raf);
    };
    frame = window.requestAnimationFrame(raf);

    // In-page anchors have to go through Lenis or they jump while it animates.
    const onAnchorClick = (event: MouseEvent): void => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a[href^="#"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const id = anchor.getAttribute("href")?.slice(1);
      if (!id) return;

      const target = document.getElementById(id);
      if (!target) return;

      event.preventDefault();
      lenis.scrollTo(target, { offset: -24 });

      // preventDefault also cancels the browser's own job of moving the focus
      // point to the target, which leaves a keyboard user carrying on from the
      // nav link they just used. preventScroll so the focus does not fight the
      // animation it just started.
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    };

    document.addEventListener("click", onAnchorClick);

    return () => {
      document.removeEventListener("click", onAnchorClick);
      window.cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
