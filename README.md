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
| `/q/[slug]` | Customer view — join, watch your place, leave |
| `/dashboard/[id]` | The counter: serve, call, skip, add a walk-in |
| `/dashboard/[id]/history` | Every finished entry as a sortable, filterable table, with CSV export |
| `/dashboard/[id]/share` | The link, the QR code, the print sheet, the display board and the customer view |
| `/dashboard/[id]/settings` | Queue configuration (owner) |
| `/display/[slug]` | Full-screen board for a wall screen |
| `/print/[slug]` | Printable QR sheet |
| `/queues`, `/operators`, `/enter` | Owner's queues, staff roster, code entry |

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

```bash
npx playwright test
```

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
