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
 * Set once, before first paint, whenever the reel is not going to run — and
 * never touched again for the rest of the page's life. CSS uses this alone to
 * hide the reel overlay, rather than the absence of data-reel="playing":
 * that value is intentionally cleared partway through a real playthrough, to
 * hand the landing's own entrance its cue for the crossfade, and gating
 * visibility on it would cut a real play's morph short.
 *
 * Without a stable signal like this, the skip case still paints the overlay
 * for one frame: the server-rendered HTML always includes it (React's state
 * has to start identically on server and client, before either can know
 * whether this tab has seen the reel), so on a hard refresh the browser
 * paints that HTML — ticket-tearing keyframes and all — before hydration's
 * layout effect ever runs to unmount it. This attribute is written by the
 * blocking inline script below, so it is already correct on the very first
 * frame the browser paints, and CSS never starts an animation on a
 * display:none subtree in the first place.
 */
export const REEL_SKIP_ATTR = "data-reel-skip";

/** Marks the reel as already shown for this tab. */
export const REEL_SEEN_KEY = "qless:reel-seen";

/**
 * Decides — before first paint — whether the reel runs at all, and is the only
 * place that decision is made. TicketReel follows the attribute this sets
 * rather than asking again, so the two can never disagree.
 *
 * It runs once per tab. A preloader earns its keep the first time someone
 * arrives and becomes a toll on every visit after that, so the flag is written
 * to sessionStorage immediately: reloading midway through, or coming back to
 * the landing from another page, goes straight to the content. Opening the site
 * in a new tab later is a fresh arrival and gets the reel again.
 *
 * Three reasons to skip, checked in order:
 *   - not the landing page, which is the only place the reel belongs
 *   - the visitor asked for reduced motion; a preloader with the motion taken
 *     out is just a delay, which is worse than none
 *   - this tab has seen it already
 *
 * sessionStorage throws in some privacy modes, so the whole thing is wrapped —
 * a failure means no reel, never a blank page.
 */
export const reelInitScript = `(function(){try{
var skip = window.location.pathname!=="/"
  || window.matchMedia("(prefers-reduced-motion: reduce)").matches
  || !!sessionStorage.getItem(${JSON.stringify(REEL_SEEN_KEY)});
if(skip){
document.documentElement.setAttribute(${JSON.stringify(REEL_SKIP_ATTR)},"1");
return;
}
sessionStorage.setItem(${JSON.stringify(REEL_SEEN_KEY)},"1");
document.documentElement.setAttribute(${JSON.stringify(REEL_ATTR)},"playing");
}catch(e){}})();`;
