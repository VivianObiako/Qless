import { expect, test } from "@playwright/test";
import { API, createQueue, joinQueue, makeDraw, signIn, unique, upNextNumber } from "./helpers";

/**
 * A hackathon's presentation order. Three places, teams take a number, the
 * counter draws one at random with one more drawn ahead, and nobody is ever
 * told they are ahead of anybody.
 */
test("a draw hands out fixed places and calls one drawn ahead", async ({ browser, page, request }) => {
  const queue = await createQueue(request, unique("E2E Hackathon"));
  await makeDraw(request, queue.id, queue.ownerToken, 3);
  const phrase = await request.patch(`${API}/api/queues/${queue.id}`, {
    data: { callPhrase: "PRESENTING" },
    headers: { Authorization: `Bearer ${queue.ownerToken}` },
  });
  expect(phrase.ok()).toBeTruthy();

  // A team joins from its phone. The pass is a place in a draw, not a line.
  await page.goto(`/q/${queue.slug}`);
  await expect(page.getByText("At random")).toBeVisible();
  await page.getByLabel("Your name").fill("Team Alpha");
  await page.getByRole("button", { name: /take my number/i }).click();
  await expect(page.getByText("In the draw", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").first()).toContainText(/you're in the draw/i);
  await expect(page.getByRole("status").first()).not.toContainText(/ahead of you/i);

  await joinQueue(request, queue.slug, "Team Beta");
  await joinQueue(request, queue.slug, "Team Gamma");

  // Every place is gone, and a latecomer is told so rather than to wait.
  const lateContext = await browser.newContext();
  const latePage = await lateContext.newPage();
  await latePage.goto(`/q/${queue.slug}`);
  await expect(latePage.getByText("All places are taken")).toBeVisible();
  await expect(latePage.getByLabel("Your name")).toHaveCount(0);
  await lateContext.close();

  // The counter draws. Nothing is drawn before the first press.
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signIn(ownerPage, queue.ownerToken, "OWNER");
  await ownerPage.goto(`/dashboard/${queue.id}`);
  await expect(ownerPage.getByText("Places taken")).toBeVisible();
  await ownerPage.getByRole("button", { name: /^draw next$/i }).click();

  // One more is drawn ahead, and the button names it.
  await expect.poll(() => upNextNumber(request, queue.slug)).not.toBeNull();
  const drawn = await upNextNumber(request, queue.slug);
  await ownerPage.getByRole("button", { name: /^done with|^start serving/i }).first().click();
  await ownerPage.getByRole("button", { name: /^done with/i }).click();
  await expect(ownerPage.getByRole("button", { name: `Call next · ${drawn}` })).toBeVisible();

  // The wall shows the drawn number alone and what is left, never a run.
  await page.goto(`/display/${queue.slug}`);
  await expect(page.getByText(/2 still to go/)).toBeVisible();
  // The room hears the organizer's word for it, not the shop's.
  await expect(page.getByText("Now presenting", { exact: true })).toBeVisible();
  await expect(page.getByText("Now serving")).toHaveCount(0);

  // A draw cannot lose its number of places.
  await ownerPage.goto(`/dashboard/${queue.id}/settings#waiting`);
  await ownerPage.getByLabel("Number of places").fill("");
  await ownerPage.getByRole("button", { name: /save settings/i }).click();
  await expect(ownerPage.getByText(/a draw needs a fixed number of places/i)).toBeVisible();

  await ownerContext.close();
});
