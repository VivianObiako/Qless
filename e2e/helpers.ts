import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface CreatedQueue {
  id: string;
  slug: string;
  name: string;
  ownerToken: string;
  recoveryCode: string;
}

/** Unique per run, so the suite can go fully parallel against one database. */
export function unique(prefix: string): string {
  return `${prefix} ${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Setup goes through the API rather than the UI. What each test is actually
 * about is one screen or one socket; driving five forms to reach it would make
 * every failure ambiguous about which step broke.
 */
export async function createQueue(
  request: APIRequestContext,
  name = unique("E2E Barbers"),
  sessionToken?: string,
): Promise<CreatedQueue> {
  const response = await request.post(`${API}/api/queues`, {
    data: { name, description: "", averageServiceMinutes: 15, maxCapacity: null },
    headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
  });
  expect(response.status()).toBe(201);

  const body = await response.json();
  return {
    id: body.queue.id,
    slug: body.queue.slug,
    name: body.queue.name,
    ownerToken: body.ownerToken,
    recoveryCode: body.recoveryCode ?? "",
  };
}

export async function joinQueue(
  request: APIRequestContext,
  slug: string,
  name: string,
): Promise<number> {
  const response = await request.post(`${API}/api/queues/${slug}/join`, { data: { name } });
  expect(response.status()).toBe(201);
  return (await response.json()).entry.number;
}

export async function serveNext(
  request: APIRequestContext,
  queueId: string,
  token: string,
): Promise<void> {
  const response = await request.post(`${API}/api/queues/${queueId}/next`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
}

export async function createOperator(
  request: APIRequestContext,
  token: string,
  displayName: string,
  queueIds: string[],
): Promise<string> {
  const response = await request.post(`${API}/api/operators`, {
    data: { displayName, queueIds },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).accessCode;
}

export async function setShowNames(
  request: APIRequestContext,
  queueId: string,
  token: string,
  showNamesToOperators: boolean,
): Promise<void> {
  const response = await request.patch(`${API}/api/queues/${queueId}`, {
    data: { showNamesToOperators },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
}

/** Puts a session in the browser the way redeeming a code would. */
export async function signIn(page: Page, token: string, role: "OWNER" | "OPERATOR"): Promise<void> {
  await page.addInitScript(
    ([sessionToken, sessionRole]) => {
      window.localStorage.setItem("qless.session.token", sessionToken);
      window.localStorage.setItem("qless.session.role", sessionRole);
    },
    [token, role],
  );
}

/**
 * Collects every WebSocket frame the page receives. Attach before navigating —
 * the socket opens on mount and the first frames would otherwise be missed.
 */
export function captureFrames(page: Page): string[] {
  const frames: string[] = [];
  page.on("websocket", (socket) => {
    socket.on("framereceived", (frame) => {
      if (typeof frame.payload === "string") frames.push(frame.payload);
    });
  });
  return frames;
}
