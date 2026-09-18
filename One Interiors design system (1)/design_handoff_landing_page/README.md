# Handoff: One Interiors landing page — 2026 redesign

## Overview

A full redesign of the One Interiors marketing landing page (`/`), built to the locked
"Tactile Assurance" palette and type system. It keeps the pinned How-it-works sequence that
already exists in the codebase and adds five things that do not: an evidence-led Problem
section, a fifteen-check Why-trust-us spine, a click-through product walkthrough, portfolio
cards with full project metadata behind a brief-first gate, and packages priced per square
foot from `src/modules/quotation/tiers.ts`.

Target file in your codebase: `src/app/page.tsx` plus `src/components/landing/*`.

## About the design files

The files in this bundle are **design references created in HTML** — prototypes showing
intended look and behaviour, not production code to copy. `One Interiors Landing.dc.html`
is a single-file prototype using inline styles and a small runtime; do not port it verbatim.
Recreate each section as a React server or client component in the existing Next.js app,
using the patterns already in `src/components/landing/` (`Wrap`, `Section`, `Eyebrow`,
`Heading`, `Cta`, `Stat`, `SpecRow`), the `.oi-landing` token scope in
`src/app/globals.css`, `next/image` for photography and `PHOTOS` from `src/lib/imagery.ts`.

## Fidelity

**High-fidelity.** Final colours, type, spacing, copy and interaction behaviour. Recreate the
UI faithfully using the codebase's existing libraries and token scope.

---

## What is new relative to the current implementation

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 1 | Header + hero | Change | New headline and CTA wording; the quote-range stat is removed |
| 2 | Reviews strip | Change | Third cell becomes `6,000 → 14` |
| 3 | Problem ("Before you start") | **New** | Evidence board with five exhibits |
| 4 | How it works | Keep | Already implemented as a pinned track — no change needed |
| 5 | Why trust us | **Rebuild** | Twelve cards → fifteen-check scroll spine with ring counter |
| 6 | Product walkthrough | **New** | Replaces the "90-second film" band |
| 7 | Testimonial | Change | Moves onto the Alabaster surface |
| 8 | Portfolio | **Rebuild** | Full metadata per card; click opens the OneQuiz gate |
| 9 | Packages | **Rebuild** | Per-sq-ft bands and real materials from `tiers.ts` |
| 10 | FAQ / final CTA / footer | Change | "twelve checks" → "fifteen checks" everywhere |

### Section order and surfaces

Surfaces alternate so every boundary is a change of material, not a hairline:

1. Hero — photographic, dark veil
2. Reviews strip — Alabaster `#FCFCFA`
3. Problem — Raw Silk `#EAE6DF`
4. How it works — Alabaster
5. Why trust us — Deep Espresso `#2C2624`
6. Product walkthrough — photographic, dark veil
7. Testimonial — Alabaster
8. Portfolio — Raw Silk
9. Packages — Alabaster
10. FAQ — Raw Silk
11. Final CTA — Terracotta `#C0613C`
12. Footer — Deep Espresso

---

## Screens / views

### 1. Header

Absolutely positioned over the hero, transparent, `padding: 24px clamp(24px,4vw,56px)`,
three-part flex with `justify-content: space-between`.

- **Left** — door-swing `Mark` at 25px, wordmark "One Interiors" in Instrument Serif 21px
  `#FCFCFA`, then "PUNE" in IBM Plex Mono 9.5px / `.2em` at 62% opacity.
- **Centre nav** — 14.5px Instrument Sans, `rgba(252,252,250,.88)`, gap `clamp(16px,2.2vw,32px)`:
  How it works · Portfolio · Packages · Why trust us. Hidden below 1040px.
- **Right** — text link "Talk to an architect" with a 1px 35%-opacity underline (hidden below
  760px), then the primary CTA **"Find your designer"**: Terracotta `#C0613C`, `#FFF8F1` text,
  14.5px/500, padding 13px 22px, square corners.

### 2. Hero

`height: min(92vh,780px); min-height: 640px`, photographic, squared. A seven-second intro
sequence runs on load (see Interactions), settling into a looping showreel.

- **Eyebrow** — mono 11px `.22em` uppercase, 72% white: "Pune · 6,000 studios screened, 14 listed"
- **H1** — Instrument Serif `clamp(38px,5vw,64px)`, line-height 1.04, `-.015em`, `#FCFCFA`:
  "Find the right interior designer<br>for your home."
- **Body** — 18px/1.55, 86% white, max-width 560px: "Answer nine questions about your flat. We
  match you with studios that actually fit it, price the first quote off their own rate card,
  and give you a personal architect to check every step."
- **CTAs** — primary "Find your interior designer" (Terracotta, 16px/500, 17px 30px);
  secondary "See how it works" with a play triangle, 1px 42%-white border, links to
  `#walkthrough`.
- **Right rail** — "SHOWREEL · 06 PROJECTS" chip with a pulsing Terracotta 7px square, and a
  rotating caption block (serif 23px project name over mono locality · area · cost).

**Wording rule (load-bearing):** every CTA says *find* / *get*, never *request*. See the
existing docblock at the top of `src/app/page.tsx`.

### 3. Reviews strip

Alabaster, 1px `#DBD5CB` top and bottom borders, `repeat(auto-fit,minmax(240px,1fr))`, each
cell `padding: 30px clamp(24px,3vw,36px)` with a right hairline.

1. `4.8` mono 28px + "/ 5" — "from 41 clients who finished a project"
2. `68` — "briefs matched to Pune studios"
3. `6,000 → 14` — "Pune studios screened, currently listed"
4. Sage tick + "Free until you book" / "studios pay us, never you"

The old `₹5.95 L–₹27.2 L` cell is **removed** — do not reintroduce the range on this page.

### 4. Problem — "Before you start" (NEW)

Two columns, `repeat(auto-fit,minmax(320px,1fr))`, gap `clamp(28px,4vw,60px)`.

Header: eyebrow "Before you start"; H2 "Five reasons this goes wrong, and the evidence for
each."; body "Nothing here is invented. It is what people forwarded us while they were trying
to get their flat done. Open any one of them."

**Left — five accordion rows.** `grid-template-columns: auto minmax(0,1fr)`, 1px top hairline,
padding `20px 18px 20px 16px`, pointer cursor. Active row: background `rgba(192,97,60,.08)`,
number in Terracotta, title in `#2C2624`; inactive: title and number in `#6B615C` / Sage.
Active row expands (`max-height 0 → 340px`, 450ms `cubic-bezier(.3,.8,.3,1)`) to reveal the
body paragraph plus a sage-ticked "WHAT WE DO INSTEAD" answer.

| # | Title | Body | What we do instead |
|---|-------|------|--------------------|
| 01 | "So what will this actually cost?" | Ask three studios for a number and you get three non-answers. No range, no per-sq-ft, no basis — just come to the office. | Budget bands priced per square foot of your carpet area, on screen before you speak to anyone. |
| 02 | "Why does every quote look different?" | One is four lines on a letterhead. One is a photograph of a printout. One is eleven pages with no total. Nothing lines up, so nothing can be compared. | Every quote is written to the same lines, so two studios sit side by side row for row. |
| 03 | "Premium ply — meaning what, exactly?" | The words on a quote are chosen so they cannot be checked. Premium, imported, branded, soft-close. No thickness, no brand, no quantity. | Carcass, shutter and hardware named on every line, with the quantity it was priced on. |
| 04 | "Six thousand studios all look the same." | Every profile says best in Pune, every rating is 4.9, every portfolio is the same twelve photographs. There is no honest way to shortlist. | Six thousand screened to fourteen listed — then scored against your brief, with the reason shown. |
| 05 | "It went quiet after we paid the advance." | The designer who sold you the project is not the person who runs the site. Messages get delivered and not answered. | A personal architect on our payroll — not the studio's — stays with you through handover. |

**Right — the matching exhibit.** A grid stack (all five at `grid-area: 1/1`), `min-height: 420px`,
only the active one at `opacity: 1` (450ms). Each exhibit is an Alabaster card, 1px hairline,
`box-shadow: 0 26px 50px -34px rgba(44,38,36,.45)`, `padding: clamp(20px,2.6vw,28px)`, with a
mono caption row above it ("WHATSAPP · THREE STUDIOS, ONE QUESTION" … and "EXHIBIT 01").

- **Exhibit 01** — chat thread. Outgoing bubble (Espresso ground, `#F6F1E8` text): "Hi — roughly
  what would a 2 BHK in Baner cost to do up?" / 10:42 · SEEN. Three incoming bubbles
  (`#EFEAE1`, hairline border): "Depends on your requirement ma'am 🙏" 10:51 · "Better you visit
  our office once, we will discuss" 11:06 · "Anywhere between 5 and 25 lakh" 11:44.
  Flag: THREE REPLIES. NO NUMBER.
- **Exhibit 02** — three quote cards, `minmax(150px,1fr)`: *Studio A · 1 page* "Complete interior
  work as discussed / 12,50,000"; *Studio B · photograph* a dashed placeholder reading
  "IMG_2481.JPG / HANDWRITTEN"; *Studio C · 11 pages* mono list "4.1 CARCASS / 4.2 SHUTTER /
  4.3 EDGE BAND / 4.4 …" and "NO TOTAL" in Terracotta. Flag: NOTHING LINES UP.
- **Exhibit 03** — one quote line: "Wardrobes — premium ply, imported hardware, soft close" /
  `4,20,000` mono. Four flags: WHICH PLY? 12MM OR 18MM? · WHICH BRAND? · HOW MANY SQ FT? ·
  BWP OR COMMERCIAL? Closing line: "Four unanswerable questions in one line. Multiply by forty
  lines and that is a contract you cannot read."
- **Exhibit 04** — twelve identical search tiles `minmax(108px,1fr)`, each "Best Interiors in
  Pune / ★ 4.9 · 12 PHOTOS". Flags: 6,000 OF THESE · EVERY RATING 4.9.
- **Exhibit 05** — three outgoing messages, no replies: "Sir, when is the carpenter coming?"
  14 MAR · DELIVERED / "Any update? Kitchen is still open" 19 MAR · DELIVERED / "Please respond,
  we have moved in already" 27 MAR · DELIVERED. Flags: NO REPLY IN 13 DAYS · ADVANCE PAID: 40%.

**Flag component** — inline flex, 7px gap: a 16×1.5px Terracotta bar then mono 9.5px `.16em`
Terracotta text. Reuse it anywhere a gap or omission is being pointed at.

### 5. How it works (unchanged)

Already implemented in `src/components/landing/HowItWorks.tsx` as a pinned track with
`QuizSnap / MatchSnap / QuoteSnap / CompareSnap / ExpertSnap`. The prototype reproduces the
same behaviour; nothing to port. Two copy points to confirm:

- OneQuote body: "One click. We price your brief off each studio's own rate card and hand you
  the first quote in three seconds."
- The quote snapshot chrome reads "QUOTE · GENERATED IN 3.2 S" and its strip reads "Nobody was
  phoned. Our system priced your brief off Teakline's own rate card and wrote this quote line
  by line." Never "request a quote".

### 6. Why trust us — fifteen checks (REBUILD)

Deep Espresso surface. Header row: eyebrow "Why trust us"; H2 "Six thousand studios in Pune.
Fourteen got through."; body "We handpick, then verify. Fifteen mandatory checks, every one
with a named verifier — scroll them and watch the count fill."; right-aligned two-line mono
note "ONE FAILED CHECK, NOT LISTED / UNTIL FIXED AND RE-CHECKED" (each line `white-space: nowrap`).

Two columns, `minmax(280px,1fr)`.

**Left, pinned panel** — a 180px SVG ring: track `rgba(252,252,250,.18)`, fill Sage `#839073`,
`r=54`, `stroke-width 5`, `stroke-dasharray 339.3`, `stroke-dashoffset = 339.3 × (1 − cleared/15)`,
rotated −90°, 450ms transition. Centre: mono 44px count over "OF 15 CLEARED" (mono 10.5px
`.18em`). Below: "NOW READING", the active check name in Instrument Serif 26px, "VERIFIED BY
<PARTY>" in mono 10.5px Sage `#B9C4A9`, then a 1px-bordered "Find your designer" link.

**Right, the list** — `height: min(70vh,560px); overflow-y: auto`, fifteen rows. Each row: 1px
top hairline `rgba(252,252,250,.16)`, padding 22px 4px, mono index in `#B9C4A9` + mono category
at 50% white, title 17px/600 `#FCFCFA`, detail 14.5px/1.55 at 68% white (max-width 520px), and
"VERIFIED BY …" in mono 9.5px Sage. Rows above the read line sit at `opacity: 1`, the rest at
`.38`. A 220px spacer closes the list.

The first twelve come from `TIER2_CHECKS` in `src/data/studios.ts`; **13–15 are new** and need
adding to the check vocabulary if you want the studio profile to agree with this page.

| # | Category | Title | Detail | Verified by |
|---|----------|-------|--------|-------------|
| 01 | Identity | PAN and legal name match | The name on the PAN is the name on the contract you sign. | PROTEAN |
| 02 | Identity | Aadhaar KYC of the principal | The person who owns the studio, verified — not an office manager. | IDFY |
| 03 | Premises | Registered address visited | Somebody from our team stood at the address on the registration. | OUR TEAM |
| 04 | Contact | Working number and email | Called and emailed. A studio we cannot reach cannot be listed. | OUR TEAM |
| 05 | Conduct | Code of conduct signed | No cold calling you, no pressure closing, no unapproved substitutions. | SIGNED |
| 06 | Tax | GSTIN active | Checked on the GST portal, not from a screenshot they sent us. | GST PORTAL |
| 07 | Tax | Twelve months of GST filings | GSTR-1 and 3B filed monthly. Gaps say more than a portfolio does. | GST PORTAL |
| 08 | Legal | Company filings current | Annual returns up to date, or the proprietorship declared as one. | MCA |
| 09 | Legal | Udyam registration | The business exists as a business, at the size it claims. | UDYAM PORTAL |
| 10 | Clients | Three past clients called | Asked about delays, and final cost against quoted cost. | OUR TEAM |
| 11 | Work | Two finished sites inspected | We stand in the flat. Instagram photographs do not count. | OUR TEAM |
| 12 | Disputes | Litigation and consumer search | eCourts and NCDRC, under both trade and legal name. | ECOURTS + NCDRC |
| 13 | Money | Rate card filed and locked | Their own per-sq-ft prices, on record — what your first quote is built from. | OUR PRICING TEAM |
| 14 | After | Workmanship warranty on paper | Duration stated, in the contract, on hardware, finish and workmanship. | LEGAL REVIEW |
| 15 | Site | Labour insurance and site safety | Current certificate for the people who will be working in your home. | INSURER CERTIFICATE |

### 7. Product walkthrough (NEW — replaces the film band)

Full-bleed photograph (`PHOTOS` site-visit image) under
`linear-gradient(200deg, rgba(28,21,17,.72), rgba(28,21,17,.9))`. Two columns,
`minmax(300px,1fr)`.

**Left** — eyebrow "The product, step by step"; H2 "This is the whole thing, one tap at a
time."; body "Brief, match, quote, compare, architect. Pick any step and the real screen
appears alongside — no sales call anywhere in it, and nothing payable by you at any point.";
then "TAP A STEP" and five selectable rows. Each row: 9px 12px padding, 999px radius, 8px
Terracotta dot (`opacity 1` active / `.28` idle), label 15px (`#FCFCFA` active, 70% white
idle), active background `rgba(252,252,250,.12)`, hover `rgba(252,252,250,.14)`.

Rows: OneQuiz — nine questions, no phone number · OneMatch — scored against your answers ·
OneQuote — priced off their rate card in seconds · OneCompare — quotes and materials side by
side · OneExpert — your architect, through handover.

**Right** — the glass frame: `display: grid; min-height: 470px; border-radius: 26px`,
`border: 1px solid rgba(252,252,250,.22)`, `background: rgba(36,29,26,.5)`,
`backdrop-filter: blur(22px) saturate(1.15)`,
`box-shadow: 0 40px 80px -40px rgba(0,0,0,.6), inset 0 1px 0 rgba(252,252,250,.16)`. Five
scenes stacked at `grid-area: 1/1`, `padding: clamp(18px,3vw,34px)`, cross-fading at 700ms.
Each scene: a chrome row (product name in serif 17px, "STEP 0X / 05" in mono) over a warm glass
card — `rgba(247,242,234,.82)`, `blur(18px) saturate(1.2)`, 18px radius, ink `#2C2624`.

Scene content is an abbreviated version of the How-it-works snapshots; reuse
`src/components/landing/snapshots.tsx` with a `compact` prop rather than writing them twice.

**Do not drive this on a timer.** It is click-selected by design — the prototype's CSS/interval
rotation could not be relied on and the frozen frame read as broken. If you add auto-advance in
React, keep click selection as the primary control and pause on interaction.

### 8. Portfolio (REBUILD)

Raw Silk. Header: eyebrow "Finished work · Pune"; H2 "Six flats, with what they cost printed on
them."; body "Scroll and the rail moves with you. Open any project and we will ask for your
brief first — so what you see is matched to your home."; two 52px square hairline arrow buttons
(hover inverts to Espresso).

**Rail** — `display: flex; gap: 34px; overflow-x: auto; scroll-snap-type: x mandatory`,
`padding: 44px clamp(24px,4vw,72px) 48px`, hidden scrollbar, `cursor: grab`. Wheel over the rail
scrolls it horizontally and releases to the page at either end; pointer drag also works.
Footer rule: "SCROLL OVER THE RAIL TO MOVE IT · 06 PROJECTS".

**Card** — `flex: 0 0 clamp(300px,32vw,420px)`, Alabaster, `padding: 18px 18px 26px`,
`box-shadow: 0 22px 50px -28px rgba(44,38,36,.5)`, resting rotation between −2.4° and +2.2°,
hover `rotate(0) translateY(-10px)` at 450ms `cubic-bezier(.2,.8,.2,1)`. Inside: a 4/3 image,
mono eyebrow "3 BHK · SANSKRITI TOWERS" in Sage, serif 28px title, 14.5px body, then a 2×2 mono
metadata grid above a hairline — LOCATION · CARPET AREA · FINISH BAND (Sage) · FINAL COST —
and a footer row with the studio name and "VIEW PROJECT →" in Terracotta.

| Title | Config · building | Location | Area | Band | Cost | Studio |
|-------|-------------------|----------|------|------|------|--------|
| Kotah & cane | 3 BHK · Sanskriti Towers | Kothrud | 1180 sq ft | Premium | ₹18.4 L | Teakline Studio |
| Oak & stone kitchen | 2 BHK · Amaltas Residences | Baner | 960 sq ft | Premium | ₹11.2 L | Chitra & Co. |
| Joinery & layered light | 4 BHK · Veda Vista | Wakad | 1420 sq ft | Luxury | ₹27.2 L | Teakline Studio |
| Laminate, done well | 1 BHK · Nirvana Greens | Hinjawadi | 640 sq ft | Essential | ₹5.95 L | Maya Workshop |
| Quiet Art Deco | 3 BHK · Ashirwad Park | Aundh | 1050 sq ft | Premium | ₹16.8 L | Chitra & Co. |
| Built for three generations | 2 BHK · Shreeji Elite | Kothrud | 880 sq ft | Premium | ₹9.6 L | Maya Workshop |

Studio and building names are **invented** for marketing surfaces. Never use real partner names
here.

### 9. The brief-first gate (NEW)

Clicking any portfolio card opens a modal instead of navigating. In the app this should route
to `/quiz` on confirm, and the modal needs focus trapping, `Escape` to close, a labelled
dialog role and background scroll lock — none of which the prototype implements.

Overlay: `position: fixed; inset: 0`, `rgba(28,21,17,.66)`, `backdrop-filter: blur(10px)`.
Card: `min(540px,100%)`, `rgba(247,242,234,.94)`, `blur(20px) saturate(1.2)`, 26px radius,
1px `rgba(252,252,250,.7)` border, `box-shadow: 0 50px 90px -40px rgba(0,0,0,.6)`,
`padding: clamp(26px,4vw,38px)`.

- Row: "BRIEF FIRST" mono Terracotta · "CLOSE ✕" mono `#6B615C`
- H3 serif `clamp(26px,3vw,34px)`: "Tell us about your flat, and the full project opens."
- Body: "Project pages carry the room-by-room photographs, the specification behind each line,
  and the quote that built it. We open them once we know what you are planning — so you are
  reading a project matched to your home, not somebody else's."
- Three sage-ticked lines, hairline top and bottom: "Room by room, with the material named on
  every element" · "The actual line-by-line quote, and what moved during the build" · "The
  studio that built it — and whether it fits your brief"
- Buttons: "Start OneQuiz · 2 min" (Terracotta) and "Not now" (1px ink border)
- Footnote mono: "NO PHONE NUMBER NEEDED TO START"

### 10. Packages (REBUILD)

Alabaster. Header: eyebrow "Packages"; H2 "Three bands, described in materials rather than
adjectives."; right two-line mono note "ALL-IN, PER SQ FT OF CARPET AREA / THE QUIZ RE-COSTS IT
FOR YOUR FLAT".

Three cards, `minmax(290px,1fr)`, gap 26px, Raw Silk ground inside an Alabaster section, 1px
hairline (Premium: 1.5px Terracotta plus a "MOST COMPARED" tab at `top:-1px; right:24px`,
`white-space: nowrap`). Each card: mono band label, mono 28px per-sq-ft figure, mono 11px
"₹X–Y L FOR 1180 SQ FT", promise 14.5px, then sage-ticked materials above a hairline, then a
"NOT THIS BAND IF" note in Terracotta mono, then the CTA ("Get this quoted"; Premium filled).

Bands and materials come straight from `TIER` in `src/modules/quotation/tiers.ts` —
read them from there rather than hard-coding:

- **Essential** ₹700–1,100/sq ft · ₹8.3–13 L · "Everything you need, made well, with nothing
  spent on show."
- **Premium** ₹1,100–1,800/sq ft · ₹13–21.2 L · "Better materials where they are touched, and
  more design time."
- **Luxury** ₹1,800–3,200/sq ft · ₹21.2–37.8 L · "Made to your drawings, in the materials you
  chose."

The `notFor` strings are already in `tiers.ts`; the page shows them shortened to one sentence.

### 11. FAQ, final CTA, footer

Unchanged in structure. Copy edits: every "twelve checks" becomes "fifteen checks", the footer
tagline reads "checked fifteen ways and quoted line by line", and the studio-facing link reads
"The fifteen checks".

---

## Interactions & behaviour

### Hero intro (on load, ~7s, one-shot)

| t | What happens |
|---|--------------|
| 0.0s | Bare-flat photograph paints in: `grayscale(1) brightness(1.5) contrast(.5) scale(1.08)` → normal over 3.4s |
| 0.1s | Drafting plan draws over it — 1.25px `#FCFCFA` strokes, `stroke-dashoffset 900 → 0`, plus a door-swing arc and the mono dimension label |
| 0.35s | Five material swatches pop in from below, 200ms apart (`translateY(16px) scale(.82)` → overshoot 1.05 → 1) |
| 1.35s | Three furniture panels wipe in from the right, `clip-path: inset(0 100% 0 0)` → `inset(0)` |
| 3.2s | Swatches and panels leave; a dark veil fades in |
| 3.4s | Six project stills fly past the centre, 300ms apart, `translate3d(880px…)` → `translate3d(-880px…)` with blur and scale |
| 4.55s | "One Interiors" sets letter by letter, 50ms apart, each `translateY(42px) scale(1.5) blur(6px)` → settled |
| 5.05s | The door-swing mark draws — wall stubs, then the arc, then the leaf |
| 5.25s | A light flare sweeps under the wordmark |
| 6.15s | The lockup shrinks away; the looping showreel and headline rise in, 200ms apart |

All of it is decorative — the headline, CTAs and nav must be present and usable with animation
disabled. Wrap the whole sequence in `prefers-reduced-motion: reduce → no animation` and let
the final state be the resting state.

### How it works — pinned scroll

Already implemented. Two things the prototype learned the hard way and are worth keeping:

1. **Nothing in the ancestor chain may create a scroll container.** An `overflow-x: hidden` on a
   wrapper silently breaks `position: sticky` (the sticky element's containing block becomes
   that scroller) *and* stops `window` scroll events. Use `overflow-x: clip` where horizontal
   clipping is needed.
2. Derive the step from the track's `getBoundingClientRect()` against the scrolling element's
   height, and expose a progress rail ("STEP 03 / 05 · KEEP SCROLLING") so the reader always
   knows how much is left.

### Why trust us — scroll spine

The check list is its own scroll container. On scroll, find the row nearest 34% of the
container height: that is the active check (name, verifier, ring). Rows at or above the read
line go to full opacity, the rest to `.38`. Wheel events inside the list only stop propagating
when the list is not at either end, so the page keeps scrolling past the section.

### Portfolio rail

Wheel with `|deltaY| > |deltaX|` over the rail maps to horizontal scroll; at either end the
event is left alone so the page scrolls. Snap is disabled during wheel and drag and restored
180ms after the last event. Arrows advance by one card width + 34px gap.

### Accordions and tabs

FAQ: single-open accordion, `max-height` 0 ↔ 240px at 450ms `cubic-bezier(.3,.8,.3,1)`, the
`+` mark rotating 45°. Testimonials: three cross-faded panels with mono `01 / 02 / 03` tabs,
active tab in Terracotta, counter "01 / 03".

### Responsive

- ≥1040px: full nav; two-column sections
- 760–1040px: nav hidden, secondary CTA visible
- <760px: hero rail and secondary CTA hidden; every two-column grid collapses via
  `repeat(auto-fit,minmax(…,1fr))`
- Below `lg` the pinned How-it-works must **not** pin — stack each step above its snapshot

---

## State

| State | Type | Drives |
|-------|------|--------|
| `step` | 0–4 | How-it-works snapshot, step highlight, progress rail. Set by scroll position and by clicking a step |
| `pain` | 0–4 | Problem row expansion and which exhibit shows. Click only. Default 0 |
| `wt` | 0–4 | Walkthrough scene and step-row highlight. Click only. Default 0 |
| `trust` | 0–14 | Ring offset, count, active check name and verifier. Scroll only |
| `quote` | 0–2 | Testimonial panel. Click only |
| `gate` | boolean | Brief-first modal. Opened by any portfolio card; closed by CLOSE, "Not now", and (to add) `Escape` |

No data fetching on this page beyond what `page.tsx` already does. `tiers.ts` and
`studios.ts` should be read at build time for the package bands and check list.

---

## Design tokens

Already in `.oi-landing` in `src/app/globals.css`. For reference:

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#EAE6DF` | Raw Silk — page ground |
| `--card` | `#FCFCFA` | Alabaster — cards, tables, quote documents |
| `--ink` | `#2C2624` | Deep Espresso — type, dark surfaces |
| `--ink2` | `#6B615C` | Secondary ink on light |
| `--acc` | `#C0613C` | Terracotta — high-intent actions, gap flags |
| `--sec` | `#839073` | Muted Sage — verification, scores, better spec |
| `--line` | `#DBD5CB` | Hairline |

Support values used on dark and glass surfaces: `#F6F1E8` (ink-on-dark), `#E0A98C` (Terracotta
on Espresso), `#B9C4A9` (Sage on Espresso), `#E2D9CB` (hairline inside warm glass),
`#9A8F86` (mono labels inside warm glass), `#EFEAE1` (incoming chat bubble),
`rgba(247,242,234,.76–.94)` + `blur(18–20px)` (warm card on glass),
`rgba(36,29,26,.5)` + `blur(22px)` (glass frame).

**Type** — Instrument Serif (headlines, product names, pull quotes, `-.015em` at display sizes);
Instrument Sans (body and UI, 13.5–19px); IBM Plex Mono (labels, eyebrows at `.14–.22em`,
money, quantities, specs, scores, counters — never body copy).

**Radius** — squared everywhere **except** glass surfaces and anything inside them: 26px frames,
12–18px inner, 999px pills on glass only.

**Spacing** — section padding `clamp(64px,8vw,100px)` block / `clamp(24px,4vw,72px)` inline;
content max-width 1280px; card gaps 26–34px.

**Shadows** — `0 22px 50px -28px rgba(44,38,36,.5)` (portfolio card) ·
`0 26px 50px -34px rgba(44,38,36,.45)` (exhibit card) ·
`0 40px 80px -40px rgba(0,0,0,.6), inset 0 1px 0 rgba(252,252,250,.16)` (glass frame) ·
`0 50px 90px -40px rgba(0,0,0,.6)` (modal).

---

## Assets

Six licensed stock photographs from `src/lib/imagery.ts` (`PHOTOS`) stand in throughout —
living room with linen sofa, oak-and-stone kitchen, joinery with layered lighting, plainly
finished bedroom, drawings-on-a-table, and a designer on site. **All of it expires before
launch** and must be replaced with real project work; the hero and walkthrough grounds are
stills where films belong. The only drawn asset is the door-swing `Mark` from
`src/components/brand.tsx`.

---

## Files in this bundle

- `One Interiors Landing.dc.html` — the full landing page prototype (all sections, all
  interactions). Open it in a browser.
- `One Interiors - Landing Page.html` — the same page bundled standalone with fonts and
  photography inlined; works offline.
- `LOCKED-DESIGN-DECISIONS.md` — the locked design decisions this page is built to. Read this first if anything
  in the prototype and this README disagree.

## Implementation order

1. Copy edits across hero, FAQ, footer and the reviews strip (small, ships on its own)
2. Packages rebuilt off `tiers.ts`
3. Portfolio metadata + the brief-first gate with proper dialog semantics
4. The Problem evidence board
5. Why trust us at fifteen checks — and adding checks 13–15 to the studio check vocabulary
6. The walkthrough, reusing `snapshots.tsx` in a compact variant
