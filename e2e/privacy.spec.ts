import { expect, test } from "@playwright/test";
import { captureFrames, createQueue, joinQueue, serveNext, setShowNames, unique } from "./helpers";

/**
 * The payload tests, read off the wire rather than off the screen. A name that
 * never reaches the browser cannot be leaked by a future component; a name that
 * arrives and is merely not rendered can be.
 */
test("the public socket frame carries no customer name", async ({ page, request }) => {
  const queue = await createQueue(request, unique("E2E Public"));
  const secret = "Nkechi";

  const frames = captureFrames(page);
  await page.goto(`/q/${queue.slug}`);

  await joinQueue(request, queue.slug, secret);
  await serveNext(request, queue.id, queue.ownerToken);

  await expect.poll(() => frames.length, { timeout: 10_000 }).toBeGreaterThan(0);

  const wire = frames.join("\n");
  expect(wire).not.toContain(secret);
  expect(wire).not.toContain("customerName");
  expect(wire).toContain("servingNumber");
});

test("with names off, the staff socket frame carries no customer name", async ({
  page,
  request,
}) => {
  const queue = await createQueue(request, unique("E2E Staff"));
  await setShowNames(request, queue.id, queue.ownerToken, false);
  const secret = "Olamide";

  const frames = captureFrames(page);
  // The dashboard's own socket, authenticated the way the app does it.
  await page.goto(`/dashboard/${queue.id}?k=${queue.ownerToken}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(queue.name);

  await joinQueue(request, queue.slug, secret);
  await expect.poll(() => frames.length, { timeout: 10_000 }).toBeGreaterThan(0);

  // The owner is on this socket, so the name is expected here — this asserts
  // the fixture is real before the operator half means anything.
  expect(frames.join("\n")).toContain(secret);
});

test("an operator on a names-off queue never receives the name", async ({
  browser,
  request,
}) => {
  const queue = await createQueue(request, unique("E2E Redacted"));
  await setShowNames(request, queue.id, queue.ownerToken, false);
  const secret = "Chiamaka";

  const response = await request.post(`http://localhost:8080/api/operators`, {
    data: { displayName: "E2E Staffer", queueIds: [queue.id] },
    headers: { Authorization: `Bearer ${queue.ownerToken}` },
  });
  const accessCode = (await response.json()).accessCode;

  const redeemed = await request.post(`http://localhost:8080/api/access/redeem`, {
    data: { code: accessCode },
  });
  const operatorToken = (await redeemed.json()).token;

  const context = await browser.newContext();
  const page = await context.newPage();
  const frames = captureFrames(page);
  await page.goto(`/dashboard/${queue.id}?k=${operatorToken}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(queue.name);

  await joinQueue(request, queue.slug, secret);
  await expect.poll(() => frames.length, { timeout: 10_000 }).toBeGreaterThan(0);

  expect(frames.join("\n")).not.toContain(secret);
  await context.close();
});
