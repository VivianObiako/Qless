/**
 * Moving the site to a new address would otherwise sign everyone out: browser
 * storage belongs to one origin, so tickets and sessions kept on the old
 * address are invisible at the new one. Printed QR codes keep pointing at the
 * old address forever, so it never goes away; it hands over instead.
 *
 * On an old address, this collects the browser's own entries and navigates to
 * the same path on the new one, carrying them in the URL fragment, which is
 * never sent to a server. On the new address, it stores what arrived without
 * overwriting anything, then wipes the fragment from the address bar.
 *
 * A link anyone could craft must not be able to plant someone else's session,
 * so the new address accepts a handoff only when the browser says it came from
 * an old address. The site sends no Referer by default, so the old address
 * navigates through a link that sends its bare origin and nothing more.
 */

export interface HandoffConfig {
  /** The canonical origin, e.g. https://lessqueues.com. */
  site: string;
  /** Hostnames that hand over to it, e.g. qless-indol.vercel.app. */
  legacyHosts: string[];
}

/** The parts of `window` the handoff touches, so tests can pass their own. */
export interface HandoffWindow {
  location: { hostname: string; pathname: string; search: string; hash: string };
  localStorage: Storage;
  document: { referrer: string; createElement(tag: "a"): HTMLAnchorElement };
  history: { replaceState(data: unknown, unused: string, url: string): void };
}

/** Self-contained, with nothing from outside its own body: it is also inlined into the page head. */
export function runHandoff(config: HandoffConfig, win: HandoffWindow): void {
  var PREFIX = "qless.";
  var MARK = "#qless-handoff=";
  var loc = win.location;

  if (config.legacyHosts.indexOf(loc.hostname) !== -1) {
    var data: Record<string, string> = {};
    var found = false;
    try {
      for (var i = 0; i < win.localStorage.length; i++) {
        var key = win.localStorage.key(i);
        var value = key === null ? null : win.localStorage.getItem(key);
        if (key !== null && value !== null && key.indexOf(PREFIX) === 0) {
          data[key] = value;
          found = true;
        }
      }
    } catch (e) {
      // Storage blocked: still move them to the new address, empty-handed.
    }
    var link = win.document.createElement("a");
    link.href =
      config.site + loc.pathname + loc.search + (found ? MARK + encodeURIComponent(JSON.stringify(data)) : "");
    link.referrerPolicy = "origin";
    link.click();
    return;
  }

  // Read before wiping: location is live, so the fragment is gone afterwards.
  var fragment = loc.hash;
  if (fragment.indexOf(MARK) !== 0) return;
  win.history.replaceState(null, "", loc.pathname + loc.search);

  var from = "";
  try {
    from = new URL(win.document.referrer).hostname;
  } catch (e) {
    return;
  }
  if (config.legacyHosts.indexOf(from) === -1) return;

  try {
    var arrived: unknown = JSON.parse(decodeURIComponent(fragment.slice(MARK.length)));
    if (typeof arrived !== "object" || arrived === null) return;
    var entries = arrived as Record<string, unknown>;
    // A session's token and role are one sign-in: never pair one with the other's.
    var SESSION = PREFIX + "session.";
    var hasSession = win.localStorage.getItem(SESSION + "token") !== null;
    for (var k in entries) {
      var v = entries[k];
      if (hasSession && k.indexOf(SESSION) === 0) continue;
      if (k.indexOf(PREFIX) === 0 && typeof v === "string" && win.localStorage.getItem(k) === null) {
        win.localStorage.setItem(k, v);
      }
    }
  } catch (e) {
    // A mangled fragment hands over nothing; the person signs in again.
  }
}

/** The configured handoff, or null where none is set (local, previews). */
export function handoffConfig(site: string | undefined, legacyHosts: string | undefined): HandoffConfig | null {
  const hosts = (legacyHosts ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  if (!site || hosts.length === 0) return null;
  return { site: site.replace(/\/+$/, ""), legacyHosts: hosts };
}

/**
 * Runs before first paint, like the theme script, so an old address never
 * renders before it moves on. The function is the tested one, stringified.
 */
export function handoffInitScript(config: HandoffConfig): string {
  return `(${runHandoff.toString()})(${JSON.stringify(config)},window);`;
}
