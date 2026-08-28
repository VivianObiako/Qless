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
| `/dashboard/[id]` | Operator counter, history and settings |
| `/display/[slug]` | Full-screen board for a wall screen |
| `/print/[slug]` | Printable QR sheet |
| `/queues`, `/operators`, `/enter` | Owner's queues, staff roster, code entry |

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
