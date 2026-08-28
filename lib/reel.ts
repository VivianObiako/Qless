/**
 * The landing page's load sequence: a strip of tickets tearing off one by one,
 * resolving into the hero ticket.
 *
 * Three phases, held on the document element so CSS can gate the landing's own
 * entrance without any component needing to know about the reel:
 *
 *   playing  — reel is on screen; hero reveals paused, hero ticket hidden
 *   landing  — reel is morphing; hero text reveals, hero ticket still hidden
 *   (absent) — reel is gone; everything behaves normally
 */
export const REEL_ATTR = "data-reel";

/**
 * Sets the phase before first paint so the landing never flashes underneath
 * the reel. Skipped entirely when the visitor prefers reduced motion — a
 * preloader with the motion removed is just a delay, which is worse than none.
 */
export const reelInitScript = `(function(){try{
if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
document.documentElement.setAttribute("data-reel","playing");
}}catch(e){}})();`;

