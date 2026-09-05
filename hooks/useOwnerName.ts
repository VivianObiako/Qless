"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, getMyQueues, updateMe } from "@/lib/api";
import { sessionRoleKey, sessionTokenKey } from "@/lib/session";
import { useStoredValue } from "./useStoredValue";

/**
 * Kept across mounts for the same reason the queue switcher keeps its list:
 * every dashboard screen renders its own chrome, and the menu should not
 * flash "Owner" on every navigation while it asks again.
 */
let remembered: { token: string; name: string } | null = null;

interface OwnerName {
  /** Empty until it loads, and for an operator or an owner without one. */
  name: string;
  isOwner: boolean;
  rename: (name: string) => Promise<boolean>;
}

/** What the owner asked to be called, and the one way to change it. */
export function useOwnerName(): OwnerName {
  const token = useStoredValue(sessionTokenKey());
  const isOwner = useStoredValue(sessionRoleKey()) !== "OPERATOR";
  const [name, setName] = useState(() => (remembered && remembered.token === token ? remembered.name : ""));

  useEffect(() => {
    if (!token || !isOwner) return;
    if (remembered && remembered.token === token) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const mine = await getMyQueues(token, controller.signal);
        remembered = { token, name: mine.displayName };
        setName(mine.displayName);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        // A menu that cannot learn the name says "Owner", which is still true.
        if (!(caught instanceof ApiError)) return;
      }
    })();

    return () => controller.abort();
  }, [token, isOwner]);

  const rename = useCallback(
    async (next: string): Promise<boolean> => {
      if (!token) return false;
      try {
        const saved = await updateMe(next, token);
        remembered = { token, name: saved.displayName };
        setName(saved.displayName);
        return true;
      } catch {
        return false;
      }
    },
    [token],
  );

  return { name, isOwner, rename };
}
