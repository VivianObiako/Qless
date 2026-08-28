# Handoff: Qless — customer ticket, room display, proximity states, landing, brand

## Overview
Qless is a zero-install virtual queue for physical businesses (bank, clinic, barbershop, event centre).
A customer scans a QR, joins, walks away, and is called back. This bundle covers the CUSTOMER and
PUBLIC-DISPLAY surfaces plus landing and logo options, in the agreed visual direction ("Ticket Pass"):
a physical ticket/boarding-pass rendered in serif numerals on a neutral near-black shell.

The direction is deliberately category-neutral: the ONLY per-venue variable is the business name.
There is no per-venue theming, no accent-colour system, no illustration.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look
and behaviour, **not production code to copy**. They are "Design Component" files (`.dc.html`) that run
against `support.js`; the markup uses inline styles and a small runtime for theme variables.

The task is to **recreate these designs in the target codebase's environment** (per the project brief:
Next.js 15 App Router, TypeScript strict, Tailwind v4, hand-built components, Radix only for Dialog)
using its established patterns. Do not port the inline-style HTML verbatim; translate it into the
codebase's component and token conventions.

## Fidelity
**High-fidelity.** Colours, typography, spacing, sizes, copy and states are final and should be matched
closely. Two exceptions marked as placeholders: the QR block (solid rectangle — render a real QR with
`qrcode.react`) and the barcode strip on the ticket (a repeating-gradient stand-in; either make it a
functional scannable code the operator can scan to serve that customer, or omit it).

## Typography
| Role | Font | Notes |
|---|---|---|
| Numerals, venue name, headlines | **Instrument Serif** (Google), regular 400 | ALL queue numbers use this. `font-variant-numeric: tabular-nums`, `letter-spacing: -.045em` at large sizes, `line-height: .8` for hero numerals |
| Labels, UI, body, buttons | **IBM Plex Mono** (Google), 400/500/600 | uppercase, letter-spacing .16–.3em for labels |

The brief's original "Inter via next/font" token is superseded by this direction. Load both via
`next/font/google`. Never set a queue numeral below 24px.

## Design Tokens

### Dark theme (DEFAULT)
```
--shell            #111111   page / phone shell
--shell-soft       #1A1A1A   board rows
--shell-mid        #262626   raised band (serving row), icon chips
--shell-line       #2E2E2E   hairlines, outline buttons
--paper            #F7F3EA   ticket stock
--paper-ink        #1A1714   text on ticket
--paper-line       #C6BCA9   dashed perforation on ticket
--paper-muted      #8C8377   labels on ticket
--strong           #FFFFFF
--dim              #B4B4B4
--muted            #8B8B8B
--faint            #6E6E6E
--board-row        #1A1A1A   neutral board row bg
--board-serving-bg #262626   "at the counter" row bg
--board-serving-fg #FFFFFF
--board-hi-bg      #FFFFFF   "YOU" row bg  (full inversion — strongest element in the list)
--board-hi-fg      #111111
```

### Light theme (user-switchable; consider making it a venue setting)
```
--shell #EFEFEC · --shell-soft #FFFFFF · --shell-mid #E5E5E5 · --shell-line #D4D4D4
--paper #FFFDF7 · --paper-ink #1A1714 · --paper-line #C6BCA9 · --paper-muted #8C8377
--strong #111111 · --dim #6E6E6E · --muted #8B8B8B · --faint #A8A8A8
--board-row #FFFFFF · --board-serving-bg #E5E5E5 · --board-serving-fg #111111
--board-hi-bg #111111 · --board-hi-fg #FFFFFF
```

### Signal colour — use once, nowhere else
```
Vermilion #E8552F   ONLY on the "It's your turn" screen and landing step 05.
```
Escalation is carried by **inversion**, not hue. If vermilion appears anywhere else (buttons, links,
badges, charts) it stops meaning "your turn" and the design fails.

### Geometry & spacing
```
Radius   24px phone shell · 12px board + display panel · 10px ticket · 8px buttons/board rows · 3px badges
Spacing  4px base scale; phone padding 24px 20px; ticket padding 22px; board rows 14px 16px
Board    1px gaps over a --shell-line container (background shows through as hairlines)
Type     9 · 10 · 11 · 12 · 13 (mono labels) — 24 · 28 · 34 · 40 · 126 · 168 · 250 · 264 (serif numerals)
```

---

## Screens / Views

### 1. Customer ticket — `/q/[slug]` (mobile-first, 390px reference width)
**Purpose:** the customer's whole product. Answers where am I / how long / is it fair, in one glance.

Vertical stack inside the shell (bg `--shell`, radius 24, padding 24/20):
1. **Header row** — "QLESS PASS" (mono 10px, .2em, `--muted`) left; right a live dot (6px circle,
   `--strong`, pulse 2.4s ease-in-out infinite, opacity 1→.35→1) + "LIVE".
2. **Ticket card** (bg `--paper`, radius 10):
   - Row: business name (Instrument Serif 28px, `--paper-ink`) + status badge (mono 9px, .18em,
     uppercase, 1px border `--paper-ink`, radius 3, padding 5/8, `white-space: nowrap`).
   - Row: left "YOUR NO." label + the customer number, **Instrument Serif 126px, line-height .8,
     letter-spacing -.045em, tabular-nums**; right column "NOW SERVING" + serif 34px, and "AHEAD" + serif 34px.
   - **Perforation:** a 24px-tall notch of shell colour on each edge (radius 0 999 999 0 / 999 0 0 999,
     width 12) with a 1px dashed `--paper-line` rule between them.
   - Bottom: "EST. WAIT" label + range in Instrument Serif 40px (e.g. "25–35 min"). **Never an exact
     call time** — a range only, computed server-side.
3. **Board** (container bg `--shell-line`, radius 12, `overflow: hidden`, `gap: 1px` between rows):
   header row "BOARD / STATUS"; then rows of serif 24px numeral + mono 10px uppercase status:
   - serving row: bg `--board-serving-bg`, text `--board-serving-fg` — "AT THE COUNTER"
   - next row: bg `--board-row`, numeral `--dim`, label `--muted` — "CALLED NEXT"
   - **you row:** bg `--board-hi-bg`, text `--board-hi-fg`, label weight 600 — "YOU"
   - trailing rows: numeral `--faint` — "WAITING"
   Numbers only, never names (privacy requirement — public WS payload carries no names).
4. **Reassurance row** — 24px rounded chip + one line of mono 12px: "Alerting you at one away. Your
   place is held if you close this."
5. Flex spacer, then **"CANCEL MY PLACE"** — ghost button, mono 11px .18em uppercase, 1px `--shell-line`,
   radius 8, padding 15px; hover: border and text go `--strong`. Opens a confirm dialog (Radix).

### 2. Proximity states (the escalation ladder)
Same 390px frame, one height across all four (860px in the reference sheet; in production the phone
viewport). State is derived from `peopleAhead` and entry status.

| # | Trigger | Treatment |
|---|---|---|
| 01 | ahead > 3 | Base state. Badge "IN QUEUE". Copy: "Go do something else. We'll alert you at one away." |
| 02 | ahead ≤ 3 | Badge inverts (ink fill, paper text) and reads "GETTING CLOSE"; ticket gains a 5-segment progress bar (4px segments, filled `--paper-ink`, empty `--paper-line`) and a right-aligned "Start heading back"; the reassurance row goes **solid white border + white chip + white text**. Copy: "Two ahead of you. About 5 minutes' walk is all you have." |
| 03 | ahead = 0, still WAITING | **Full inversion:** shell becomes `--paper`, ticket becomes ink (#1A1714) with paper text. Numeral grows to **168px**. Badge "YOU'RE NEXT". Serif 34px line: "You're up after 19." + mono 12px: "Be inside now — if you're not here when you're called, you'll be skipped and can rejoin." Board collapses to two rows (serving + "YOU — NEXT"). Primary button **"I'M HERE"** (ink fill, paper text) above the ghost cancel. |
| 04 | status = SERVING | **Full-bleed vermilion #E8552F.** Live dot pulse speeds to 1.1s and label reads "CALLED". "IT'S YOUR TURN" (mono 13px, weight 600, .3em) over the numeral at **Instrument Serif 250px** in white. Hairline rule (rgb(255 255 255 / .35)), then serif 40px "Ade is ready for you." + mono 12px "Chair 2 · Ade's Barbershop. Show this screen if anyone asks." Buttons: **"ON MY WAY"** (white fill, vermilion text) and "I NEED TWO MINUTES" (ghost, white 50% border). |

Transitions between states: cross-fade + the numeral's own change animation only; respect
`prefers-reduced-motion` (drop the pulse and any transition, keep the colour/inversion change).
Announce state changes in a polite ARIA live region; never steal focus.

### 3. Room display — `/display/[slug]` (955×506 reference, scale to any 16:9 screen)
Panel bg #111111, radius 12, padding 44, two columns split by a 1px `rgb(255 255 255 / .14)` rule.
- **Left column** (`justify-content: space-between`): "NOW SERVING" (mono 15px, .3em, **#C9A227** —
  the display's own label gold, not the signal colour); the serving number in **Instrument Serif 264px,
  line-height .74, white**; a hairline-topped block with "UP NEXT" and the next three numbers on one
  baseline row (serif 64px white / 52px white-55% / 44px white-30%); footer "BUSINESS NAME · 6 WAITING"
  (mono 13px, .2em, #8B8B8B).
- **Right column** (300px): QR **300×300** white, radius 8, with "SCAN TO JOIN THE QUEUE" centred beneath.
- No names, ever. Updates live over the public WebSocket payload.

### 4. Landing — `/` (1280px reference)
Nav (logo chip + "QLESS", "How it works", "For business", "Create a queue" as a paper-filled button) over
a 1px #262626 rule. Hero: **"Stop waiting in line."** Instrument Serif 104px, line-height .92,
letter-spacing -.035em; support line mono 15px/1.7 `--dim` max-width 460; primary "CREATE A QUEUE"
(paper fill, ink text) + secondary "SEE A LIVE DEMO" (1px #2E2E2E); microcopy "NO APP · NO ACCOUNT ·
FREE TO TRY". Right: a real ticket card (360px) so the product is visible above the fold.
Five steps as equal hairline-divided columns: 01 Scan the code · 02 Give a name · 03 Walk away ·
04 Get the nudge · 05 Walk straight in — **step 05's numeral and label in vermilion**, the only accent
on the page.

### 5. Logo options (pick one before build)
All built from the ticket's vocabulary, two typefaces only, all legible at 20px and in B/W print:
- **A** Serif wordmark — "Qless" in Instrument Serif 62px on paper.
- **B** Chip + mono lockup — 44px paper rounded square (radius 8) with a serif "Q", plus "QLESS" mono .3em.
- **C** Ticket stub — serif "Qless" between rules with perforation notches at both ends.
- **D** Perforated wordmark — "Q ··· LESS" mono .34em with three 3px dots as the tear line.
- **E** Number chip (app icon) — vermilion tile, serif "Q21" white. Best as the favicon/app icon only.
- **F** Stacked, tear line — serif "Q" over a dashed rule over "LESS" mono .34em.
Recommendation: **B** for the product UI (works in a 22px nav chip and on the print sheet) with **E**
as the app icon.

---

## Interactions & Behaviour
- **Live updates** via the queue WebSocket; the ticket re-renders on `QUEUE_UPDATED`, `CUSTOMER_SERVED`,
  `CUSTOMER_ATTENDED`, `CUSTOMER_LEFT`, `CUSTOMER_SKIPPED`, `QUEUE_PAUSED/RESUMED/CLOSED/RESET`.
- **Animation only on change**: numeral swap, board rows entering/leaving, state escalation. No ambient motion.
  The live dot pulse is the sole exception (2.4s; 1.1s on state 04).
- **Confirm dialogs** (Radix Dialog) on: cancel my place, and operator skip/close/reset. Not on Serve Next.
- **Notifications** opt-in at 3 away / 1 away / your turn; the design must remain fully usable without them.
- **Reconnection**: replace the "LIVE" pill text with "RECONNECTING…" in `--muted` (no layout shift),
  then "LIVE" on recovery; refetch full state on reconnect.
- **Accessibility**: WCAG 2.2 AA. All state changes also carry text (never colour alone); visible focus
  rings on the ghost buttons (2px `--strong` outline, offset 2px); the vermilion screen's white-on-#E8552F
  large text passes at the sizes used — do not reuse that pair at small sizes.
- **Responsive**: verify 320 / 375 / 390 / 768 / 1024 / 1440. The ticket is fluid; the numeral scales with
  `clamp()` (e.g. `clamp(96px, 32vw, 126px)`), the board and buttons stay full-width. No horizontal scroll.

## State Management
Per the brief: no global store — one `useQueue()` hook owning fetch + WebSocket.
Derived for this UI: `myNumber`, `servingNumber`, `waitingNumbers[]`, `peopleAhead` (count of waiting
numbers below mine), `estimateRange`, `queueStatus`, `connectionState`, and `proximityState` =
`serving ? 'turn' : ahead === 0 ? 'next' : ahead <= 3 ? 'close' : 'queued'`.
Theme mode: `'dark' | 'light'`, default dark, persisted locally (recommend also a venue-level default).

## Assets
No image assets. QR is generated at runtime (`qrcode.react`; canvas → PNG for the print sheet).
Fonts: Instrument Serif + IBM Plex Mono from Google Fonts via `next/font`.

## Not yet designed (next round)
Join screen, name entry, "already in this queue", skipped / paused / closed / full / queue-not-found /
connection-lost states, print sheet, operator dashboard in this final palette (an earlier version exists
in `Qless Directions - Any Business.dc.html`, direction 3a).

## Files
- `Qless.dc.html` — the build file: customer ticket + light/dark, room display, four proximity states,
  landing, logo options.
- `Qless Directions - Any Business.dc.html` — exploration sheet: direction 3a (the chosen one, incl. an
  operator dashboard) and earlier directions 2a/2b/2c for context.
- `support.js` — runtime required to open the `.dc.html` files in a browser.

