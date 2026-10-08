# Qless — web

The Next.js frontend for Qless, a zero-install virtual queue for physical
businesses. Customers scan a QR code, enter a name and get a number. The
operator runs the queue from a dashboard on the counter.

The Go API lives in [Qless-backend](https://github.com/VivianObiako/Qless-backend).

## Running it locally

Start the API first, then:

```bash
cp .env.example .env.local
npm install
npm run dev
```

The app expects the API on the URL in `NEXT_PUBLIC_API_URL`, and the API expects
this app's origin in its own `ALLOWED_ORIGIN` — both CORS and the WebSocket
handshake check it.

## Routes

| Route | Who it is for |
|---|---|
| `/` | Landing |
| `/create` | Create a queue |
| `/q/[slug]` | Customer view — join, watch your place, say you're here, leave |
| `/dashboard/[id]` | The counter: serve, call, skip, add a walk-in. With more than one chair, a rail of chairs with one open |
| `/dashboard/[id]/chairs` | Every chair as a full card, four to a row (owner) |
| `/dashboard/[id]/history` | Every finished entry as a searchable, sortable, filterable, paginated table, with CSV export |
| `/dashboard/[id]/share` | The link, the QR code, the print sheet, the display board and the customer view |
| `/dashboard/[id]/settings` | Queue configuration (owner) |
| `/display/[slug]` | Full-screen board for a wall screen, with an optional chime |
| `/print/[slug]` | Printable QR sheet |
| `/queues`, `/operators`, `/enter` | Owner's queues, staff roster, code entry |
| `/profile` | Your name, the chair each counter opens on for you, appearance, devices |

## Chairs

A queue has one or more seats — chairs, counters, rooms — drawing from one
line. A queue with one seat renders exactly as a single counter. Add a
second in Settings › Seats and the counter becomes a rail of chairs with
one open as the card, calls are aimed at a chair somebody is at, the pass
says "Go to Chair 2", the wall shows every chair, and the estimate divides
by the chairs that are open. The rules are in `docs/PLAN.md` under "Plan —
multi-seat queues" and the decisions in `docs/DECISIONS.md`.

## End-to-end tests

```bash
npx playwright test
```

They run against the real API on `:8080` and the dev server on `:3000`, and
reuse a dev server that is already running. To point them at a dev server on
another port, set `PLAYWRIGHT_BASE_URL`, which the API must also allow as an
origin. `e2e/seats.spec.ts` is the two-chair day.

## Tablets

The counter is designed to run on an iPad. Controls grow under a coarse
pointer, inputs read at 16px there so iOS does not zoom on focus, and the
layout follows the content width so both orientations work. Add it to the
home screen from Safari for a full-screen counter that keeps the screen awake.

## Notifications

The pass asks for notification permission once a customer holds a place.
With permission it registers `public/sw.js` and subscribes through the API,
which sends the nudges (close, next, your turn) itself. If the API has no
VAPID keys the pass falls back to notifying from the page while the tab is
alive. There is nothing to configure on the web side.

## Design

The current direction is **Paper**: black on white, Geist at two weights,
hairlines instead of cards, and one colour (vermilion) with one meaning — a
person being called. Tokens live in `app/globals.css`; the reasoning is in
`docs/DECISIONS.md` under "Direction — Paper".

## Configuration

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Baked into the client bundle at build time |

Being a `NEXT_PUBLIC_` value it is visible to the browser, so it must never hold
a secret. Nothing sensitive is committed; `.env*` is ignored.

## Tests

There are two layers, and they never load each other's files.

```bash
npm test           # Jest and React Testing Library: logic, components, hooks
npm run test:e2e   # Playwright: the real stack, see End-to-end tests above
```

`npm test` needs nothing running and is what CI runs on every push and pull
request, between lint and build. Tests sit beside the file they cover as
`*.test.ts(x)`, find elements the way a person would (by role, label and
accessible name), and share fixtures from `test/fixtures.ts`. `next build`
type-checks them too, so a test that no longer matches a type fails the build.

The end-to-end specs in `e2e/` need both the API and this app running.

## Docs

Product docs are in `docs/`, shared with the backend repo.

## Deploying

The app deploys to Vercel; the API is a separate Render service.

**1.** Import this repository on Vercel. It detects Next.js with no extra
configuration.

**2.** Set one environment variable:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | The Render service URL, e.g. `https://qless-api.onrender.com` |

Set it for Production, Preview and Development. It is compiled into the client
bundle, so a change needs a redeploy — and because it ships to the browser it
must never hold a secret. There are no other environment variables, and nothing
sensitive is committed.

**3.** Add the resulting Vercel domain to the API's `ALLOWED_ORIGIN`. Both CORS
and the WebSocket handshake check it, so the app cannot load data until this is
done.

### Preview deployments

Every preview gets its own domain, and the API only answers origins it has been
told about. `ALLOWED_ORIGIN` takes a comma-separated list, so add the preview
domain alongside production:

```
ALLOWED_ORIGIN=https://qless.app,https://qless-git-my-branch.vercel.app
```

Without that, a preview build loads but every API call and the live socket fail.

### The API sleeps on the free tier

The Render free instance sleeps after about 15 minutes of inactivity, so the
first request from a cold preview can take roughly 50 seconds. The queue screens
show their loading state throughout rather than erroring.
