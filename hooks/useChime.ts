"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "qless.display.sound";

interface Chime {
  /** Whether the board will sound. Remembered per device. */
  armed: boolean;
  toggle: () => void;
  /** Two short notes. Silent unless armed and the browser has heard a tap. */
  play: () => void;
}

function readArmed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeArmed(armed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, armed ? "1" : "0");
  } catch {
    // The choice lasts the page then, which is still a choice.
  }
}

/**
 * The tone a wall screen makes when the number changes, because people stop
 * watching a screen and do not stop hearing a room.
 *
 * Synthesised rather than a file: two notes need no asset, and a plain sine
 * pair reads as a chime rather than a jingle. Browsers refuse audio until the
 * page has had a gesture, so the board arms it with a tap, and a board that
 * reloads armed resumes on the first tap it gets.
 */
export function useChime(): Chime {
  // Read once the page is on the client. The board is a client component
  // rendered after hydration's first paint, so the initial read is safe, and
  // a server render (which never happens for it) would simply see "off".
  const [armed, setArmed] = useState(() => (typeof window === "undefined" ? false : readArmed()));
  const context = useRef<AudioContext | null>(null);

  const ensure = useCallback((): AudioContext | null => {
    if (typeof window === "undefined" || !("AudioContext" in window)) return null;
    if (context.current === null) context.current = new AudioContext();
    if (context.current.state === "suspended") void context.current.resume();
    return context.current;
  }, []);

  // A board that was armed before it reloaded has no gesture yet. Any tap on
  // the page is enough to let the browser start the clock.
  useEffect(() => {
    if (!armed) return;
    const wake = (): void => {
      ensure();
    };
    window.addEventListener("pointerdown", wake, { once: true });
    return () => window.removeEventListener("pointerdown", wake);
  }, [armed, ensure]);

  const toggle = useCallback((): void => {
    const next = !armed;
    setArmed(next);
    writeArmed(next);
    if (next) {
      // The tap that arms it is the gesture the browser wants, and hearing
      // the tone once is how the operator knows the volume is up.
      const ctx = ensure();
      if (ctx) tone(ctx);
    }
  }, [armed, ensure]);

  const play = useCallback((): void => {
    if (!armed) return;
    const ctx = ensure();
    if (ctx && ctx.state === "running") tone(ctx);
  }, [armed, ensure]);

  return { armed, toggle, play };
}

/** Two notes a fifth apart, each a fifth of a second, fading out. */
function tone(ctx: AudioContext): void {
  const notes = [880, 1318.5];
  notes.forEach((frequency, index) => {
    const at = ctx.currentTime + index * 0.22;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.55);
  });
}
