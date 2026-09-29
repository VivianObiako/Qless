import { expect, test } from "@playwright/test";
import { API, createQueue, signIn, unique } from "./helpers";

/**
 * An owner who has lost their recovery code, on a device that is still
 * signed in, gets a new one from Profile. The old code keeps working until
 * they say the new one is saved, and stops working after.
 */
test("a signed-in owner replaces a lost recovery code from Profile", async ({ page, request }) => {
  const queue = await createQueue(request, unique("E2E Lost Code"));
  expect(queue.recoveryCode).not.toBe("");

  await signIn(page, queue.ownerToken, "OWNER");
  await page.goto("/profile");
  await page.getByRole("button", { name: "Get a new code" }).click();

  await expect(page.getByRole("heading", { name: /save your recovery code/i })).toBeVisible();
  const fresh = (await page.locator(".recovery-ticket p.font-mono").innerText()).trim();
  expect(fresh).not.toBe(queue.recoveryCode);

  await page.getByLabel(/saved my recovery code/i).check();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(/new recovery code saved/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Get a new code" })).toBeVisible();

  const old = await request.post(`${API}/api/access/redeem`, { data: { code: queue.recoveryCode } });
  expect(old.status()).toBe(401);
  const now = await request.post(`${API}/api/access/redeem`, { data: { code: fresh } });
  expect(now.ok()).toBeTruthy();
});
