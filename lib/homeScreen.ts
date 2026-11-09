export interface DeviceFacts {
  userAgent: string;
  maxTouchPoints: number;
  /** Opened from the Home Screen rather than a browser tab. */
  standalone: boolean;
  hasNotification: boolean;
}

/**
 * An iPhone or iPad in a browser tab, where alerts only exist once the page is
 * added to the Home Screen. iPadOS reports itself as a Mac, so a Mac with a
 * touch screen counts too.
 */
export function needsHomeScreen({ userAgent, maxTouchPoints, standalone, hasNotification }: DeviceFacts): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes("Macintosh") && maxTouchPoints > 1);
  return ios && !standalone && !hasNotification;
}

export function readDeviceFacts(): DeviceFacts {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    hasNotification: "Notification" in window,
  };
}
