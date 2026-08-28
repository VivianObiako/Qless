import { expect, test } from "@playwright/test";
import { createQueue, joinQueue, serveNext, unique } from "./helpers";

test("a customer joins and sees their number", async ({ page, request }) => {
  const queue = await createQueue(request);

  await page.goto(`/q/${queue.slug}`);
  await page.getByLabel("Your name").fill("Ada");
  await page.getByRole("button", { name: /take my number/i }).click();

  await expect(page.getByText(/your no\./i)).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/your number is 1\b/i);
});

test("the position updates live when the operator serves", async ({ page, request }) => {
  const queue = await createQueue(request);
  await joinQueue(request, queue.slug, "Bola");
  await joinQueue(request, queue.slug, "Chidi");

  await page.goto(`/q/${queue.slug}`);
  await page.getByLabel("Your name").fill("Dami");
  await page.getByRole("button", { name: /take my number/i }).click();

  const live = page.getByRole("status").first();
  await expect(live).toContainText(/2 ahead of you/i);

  // No reload anywhere in this test: the change has to arrive over the socket.
  await serveNext(request, queue.id, queue.ownerToken);
  await expect(live).toContainText(/1 ahead of you/i);

  await serveNext(request, queue.id, queue.ownerToken);
  await expect(live).toContainText(/you're next/i);
});

test("a customer recovers their entry after a browser restart", async ({ browser, request }) => {
  const queue = await createQueue(request);

  const first = await browser.newContext();
  const page = await first.newPage();
  await page.goto(`/q/${queue.slug}`);
  await page.getByLabel("Your name").fill("Emeka");
  await page.getByRole("button", { name: /take my number/i }).click();
  await expect(page.getByText(/your no\./i)).toBeVisible();

  // A restart is the same browser with the same storage and nothing in memory.
  const storage = await first.storageState();
  await first.close();

  const second = await browser.newContext({ storageState: storage });
  const reopened = await second.newPage();
  await reopened.goto(`/q/${queue.slug}`);

  await expect(reopened.getByText(/your no\./i)).toBeVisible();
  await expect(reopened.getByRole("status").first()).toContainText(/your number is 1\b/i);
  await second.close();
});

test("the display board updates without a refresh", async ({ page, request }) => {
  const queue = await createQueue(request, unique("E2E Display"));
  await joinQueue(request, queue.slug, "Funke");
  await joinQueue(request, queue.slug, "Gbemi");

  await page.goto(`/display/${queue.slug}`);
  await expect(page.getByRole("status")).toContainText(/nobody is being served/i);

  await serveNext(request, queue.id, queue.ownerToken);
  await expect(page.getByRole("status")).toContainText(/now serving number 1\b/i);

  await serveNext(request, queue.id, queue.ownerToken);
  await expect(page.getByRole("status")).toContainText(/now serving number 2\b/i);
});
