"use client";

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";

interface Disclosure {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** Goes on the element that contains both the trigger and the panel. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Goes on the trigger, so closing can hand focus back to it. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  panelId: string;
}

/**
 * A popover that is a disclosure, not a menu: `aria-expanded` and
 * `aria-controls` on the trigger, ordinary links and buttons inside, and the
 * two ways out everyone expects — Escape, and a click anywhere else. Menu
 * semantics would promise roving focus and typeahead that a short list of
 * links does not need.
 */
export function useDisclosure(): Disclosure {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  const toggle = useCallback((): void => setOpen((current) => !current), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent): void => {
      const container = containerRef.current;
      if (container && event.target instanceof Node && !container.contains(event.target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { open, setOpen, toggle, containerRef, triggerRef, panelId };
}
