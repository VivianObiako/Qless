"use client";

import { useEffect, useState } from "react";

/**
 * The current time, re-read on an interval, for anything that says "N min
 * ago". Thirty seconds by default: a counter does not need seconds, and a
 * timer that ticks every second re-renders a list of rows for nothing.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}

/** Whole minutes between an ISO timestamp and now, never negative. */
export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
}
