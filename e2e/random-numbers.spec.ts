import { expect, test } from "@playwright/test";
import { API, createQueue, joinQueue, signIn, unique } from "./helpers";

/**
 * A hackathon run on random numbers: teams scan, each gets a random number
 * from 1 to the places, and presentations go from the lowest number up.
 */
test("random numbers are handed out at random and called in order", async ({ browser, page, request }) => {
  const queue = await createQueue(request, unique("E2E Random Numbers"));
  const setup = await request.patch(`${API}/api/queues/${queue.id}`, {
    data: { numbering: "RANDOM", maxCapacity: 3, personNoun: "team", peopleNoun: "teams", callPhrase: "PRESENTING" },
    headers: { Authorization: `Bearer ${queue.ownerToken}` },
  });
  expect(setup.ok()).toBeTruthy();

  // The join ticket keeps its shape, and says how the number is given.
  await page.goto(`/q/${queue.slug}`);
  await expect(page.getByText("Luck of the draw")).toBeVisible();
  await expect(page.getByText("Places left")).toBeVisible();
  await page.getByLabel("Your name").fill("Team Alpha");
  await page.getByRole("button", { name: /take my number/i }).click();
  // Whichever screen the pass lands on, waiting or next, it says how the
  // number was given.
  await expect(page.getByText("Your number was drawn at random when you joined.")).toBeVisible();

  const others = [await joinQueue(request, queue.slug, "Team Beta"), await joinQueue(request, queue.slug, "Team Gamma")];
  const state = await (await request.get(`${API}/api/queues/${queue.slug}`)).json();
  const numbers = [...state.state.waitingNumbers].sort((a: number, b: number) => a - b);
  expect(numbers).toEqual([1, 2, 3]);
  expect(others.every((n) => n >= 1 && n <= 3)).toBeTruthy();

  // Every place is gone.
  const lateContext = await browser.newContext();
  const latePage = await lateContext.newPage();
  await latePage.goto(`/q/${queue.slug}`);
  await expect(latePage.getByText("All places are taken")).toBeVisible();
  await lateContext.close();

  // The owner's settings show the mode the queue is in.
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signIn(ownerPage, queue.ownerToken, "OWNER");
  await ownerPage.goto(`/dashboard/${queue.id}/settings#waiting`);
  await expect(ownerPage.getByRole("radio", { name: "Random numbers" })).toHaveAttribute("aria-checked", "true");
  await expect(ownerPage.getByLabel("Number of places")).toHaveValue("3");
  await ownerContext.close();
});
