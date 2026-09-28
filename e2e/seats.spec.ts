import { expect, test } from "@playwright/test";
import {
  addSeat,
  createOperator,
  createQueue,
  joinQueue,
  listSeats,
  redeem,
  signIn,
  takeSeat,
  unique,
} from "./helpers";

/**
 * A two-chair day. The owner works the Counter and Ada works Chair 2; the
 * line is one line and both draw from it. Everything the customer sees has
 * to say which chair, and the counter has to aim every call at a chair
 * somebody is actually at.
 */
test("two chairs draw from one line and the customer is sent to a chair", async ({
  browser,
  page,
  request,
}) => {
  const queue = await createQueue(request, unique("E2E Chairs"));
  const chair2 = await addSeat(request, queue.id, queue.ownerToken, "Chair 2");
  const [counter] = await listSeats(request, queue.id, queue.ownerToken);

  const code = await createOperator(request, queue.ownerToken, "Ada", [queue.id]);
  const adaToken = await redeem(request, code);

  await takeSeat(request, queue.id, queue.ownerToken, counter.id);
  await takeSeat(request, queue.id, adaToken, chair2);

  await joinQueue(request, queue.slug, "Bola");

  // The customer joins second. With two chairs open one person ahead is no
  // turn at all, so the pass says "next" straight away.
  await page.goto(`/q/${queue.slug}`);
  await page.getByLabel("Your name").fill("Chidi");
  await page.getByRole("button", { name: /take my number/i }).click();
  await expect(page.getByRole("status").first()).toContainText(/you're next/i);

  // The owner's counter: a rail of two tiles, the waiting list aimed at a
  // ready chair, and Serve next on the open chair.
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signIn(ownerPage, queue.ownerToken, "OWNER");
  await ownerPage.goto(`/dashboard/${queue.id}`);
  await expect(ownerPage.getByRole("heading", { name: /chairs · 2 of 2 open/i })).toBeVisible();
  await expect(ownerPage.getByRole("button", { name: /^Counter,/ })).toHaveAttribute("aria-pressed", "true");
  await expect(ownerPage.getByText(/counter and chair 2 are ready, so call now asks which/i)).toBeVisible();

  // Bola goes to the Counter; the tile turns to their number and the list
  // now aims at the one chair left.
  await ownerPage.getByRole("button", { name: /^serve next · 1$/i }).click();
  await expect(ownerPage.getByRole("button", { name: /^Counter,.*number 1,/ })).toBeVisible();
  await expect(ownerPage.getByText(/chair 2 is free, so call now sends people there/i)).toBeVisible();

  // Chidi is called to Chair 2 from the list. Their pass says where to go.
  await ownerPage.getByRole("button", { name: /^call to chair 2$/i }).click();
  await expect(page.getByText("Go to Chair 2.", { exact: true })).toBeVisible();
  await expect(page.getByText(/ada is ready for you/i)).toBeVisible();

  // Nobody is left to call, and nothing is stood down by either call.
  await expect(ownerPage.getByRole("button", { name: /^Chair 2,.*number 2,/ })).toBeVisible();

  // Ada's counter is the same screen on her chair, with the other tile
  // visible but not openable, and no picker of other people's chairs.
  const adaContext = await browser.newContext();
  const adaPage = await adaContext.newPage();
  await signIn(adaPage, adaToken, "OPERATOR");
  await adaPage.goto(`/dashboard/${queue.id}`);
  await expect(adaPage.getByRole("button", { name: /you're at chair 2/i })).toBeVisible();
  await expect(adaPage.getByRole("button", { name: /^Chair 2,/ })).toHaveAttribute("aria-pressed", "true");
  await expect(adaPage.getByRole("button", { name: /^Counter,/ })).toHaveAttribute("aria-disabled", "true");
  await expect(adaPage.getByRole("button", { name: /^start serving$/i })).toBeVisible();

  // The wall shows both chairs, by name.
  const wall = await browser.newContext();
  const wallPage = await wall.newPage();
  await wallPage.goto(`/display/${queue.slug}`);
  await expect(wallPage.getByText(/now serving 1 at counter, 2 at chair 2/i)).toBeAttached();

  await wall.close();
  await adaContext.close();
  await ownerContext.close();
});

test("a chair nobody works is never a target", async ({ page, request }) => {
  const queue = await createQueue(request, unique("E2E Empty Chair"));
  await addSeat(request, queue.id, queue.ownerToken, "Chair 2");
  await joinQueue(request, queue.slug, "Dami");

  await signIn(page, queue.ownerToken, "OWNER");
  await page.goto(`/dashboard/${queue.id}`);

  // Two open chairs, nobody at either: no Serve next, Call now is off and
  // the list says why, and the card offers only Take this chair and Close.
  await expect(page.getByText(/no chair is ready\. take a chair/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^serve next/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^call now$/i })).toBeDisabled();
  await page.getByRole("button", { name: /^take this chair$/i }).click();

  // Taking it makes it ready: Serve next appears and the list aims at it.
  await expect(page.getByRole("button", { name: /^serve next · 1$/i })).toBeVisible();
  await expect(page.getByText(/counter is free, so call now sends people there/i)).toBeVisible();
  await page.getByRole("button", { name: /^call to counter$/i }).click();
  await expect(page.getByRole("button", { name: /^Counter,.*number 1,/ })).toBeVisible();

});
