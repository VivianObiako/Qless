import { expect, test } from "@playwright/test";
import { createOperator, createQueue, unique } from "./helpers";

test("an owner recovers on a second device and sees every queue", async ({ browser, request }) => {
  const first = await createQueue(request, unique("E2E Chair One"));
  // The same business, so this one attaches to the owner rather than minting a
  // second — which is the thing the recovery code has to bring back.
  const second = await createQueue(request, unique("E2E Chair Two"), first.ownerToken);

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/enter");
  await page.getByLabel("Code").fill(first.recoveryCode);
  await page.getByRole("button", { name: /^continue$/i }).click();

  // Redeeming rotates the code, so the replacement is put in front of the owner
  // before they go anywhere. Acknowledging it is what retires the old one.
  await expect(page.getByRole("heading", { name: /save your recovery code/i })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /^continue$/i }).click();

  await expect(page).toHaveURL(/\/queues$/);
  await expect(page.getByRole("link", { name: first.name })).toBeVisible();
  await expect(page.getByRole("link", { name: second.name })).toBeVisible();
  await context.close();
});

test("an operator sees only the queues they are assigned", async ({ browser, request }) => {
  const assigned = await createQueue(request, unique("E2E Assigned"));
  const hidden = await createQueue(request, unique("E2E Hidden"), assigned.ownerToken);
  const accessCode = await createOperator(request, assigned.ownerToken, "E2E Ada", [assigned.id]);

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/enter");
  await page.getByLabel("Code").fill(accessCode);
  await page.getByRole("button", { name: /^continue$/i }).click();

  // One queue, so an operator lands on its counter rather than on a list.
  await expect(page).toHaveURL(new RegExp(`/dashboard/${assigned.id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(assigned.name);

  await page.goto("/queues");
  await expect(page.getByRole("link", { name: assigned.name })).toBeVisible();
  await expect(page.getByRole("link", { name: hidden.name })).toHaveCount(0);

  // Owner-only screens are not theirs, and the session survives being told so.
  await page.goto("/operators");
  await expect(page.getByText(/not your team/i)).toBeVisible();
  await expect(
    page.evaluate(() => window.localStorage.getItem("qless.session.token")),
  ).resolves.not.toBeNull();

  await context.close();
});
