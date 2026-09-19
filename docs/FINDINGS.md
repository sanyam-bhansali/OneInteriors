# Findings — September 2026 customer-surface audit

Three audits of `/studios/[slug]`, `/compare`, `/expert`, `/quiz` and
`/prepare`, run before the design-language rollout. The redesign is proceeding
as **styling only**; everything here was deliberately left alone and needs
scheduling.

Ranked by what it costs if it ships as-is. P1 items contradict the product's
own argument on a page built to make that argument.

---

## P1 — claims the product cannot stand behind

### 1.1 The rate-card contradiction

- `src/data/filed-rates.ts` §"What is NOT real": *"a quote shown today is
  priced on one studio's archive wearing another studio's name."*
  `ratesAreReal()` is hardcoded `false`.
- `src/app/studios/[slug]/StudioQuotation.tsx:116` renders, in bold,
  **"{studio.tradeName}'s own rate card"**, and `:53` "has priced your brief
  from their own rate card."

The quote document carries an honest `Flag`; the prose above it asserts the
opposite. On a page whose entire argument is that our numbers are checkable,
an unhedged sentence outranks a footnote.

**Fix:** reword to what is true today — "priced on filed archive rates, not
yet this studio's own card" — and make the wording read from `ratesAreReal()`
so it corrects itself on first real ingestion rather than needing a human to
remember.

*Partly addressed by the redesign:* `StudioQuotation` is being removed, which
deletes both sentences. The underlying rule — pricing copy must be derived
from `ratesAreReal()`, never written as a constant — still needs applying to
whatever remains.

### 1.2 `materialsDiffer` is string equality

`src/modules/quotation/first-quote.ts:376,395` — `new Set(specs).size > 1` on
the raw spec sentence.

"18mm BWP ply" and "BWP plywood 18mm" register as a material disagreement.
A genuine difference phrased identically registers as none. This drives
`tellingRows` ordering **and** `tally.caveats`, and `starred.ts:26-28` treats
the caveat as a correctness invariant: *"`cheaper` is never allowed to travel
without `caveats`."*

So the page built to explain material differences raises false alarms about
them, and can miss real ones.

**Fix:** compare on normalised material *ids* from
`glossary.ts` `splitSpec`, not on the sentence. The glossary matcher already
extracts them.

### 1.3 Quiz consent is documented, rendered nowhere, never recorded

`src/app/quiz/actions.ts` — `recordQuizConsentAction` has no importer
anywhere in `src/`. `ConsentGate` renders on no page. `mayContact()` is
enforced at no send site. `withdrawConsent()` has no caller while `/account`
shows a consent history and promises withdrawal. There is no `/privacy`
route.

DPDP exposure, and `/account` currently describes a mechanism that does not
exist.

**Fix:** its own piece of work, not a line item. Flagged previously and still
open.

---

## P2 — a real user hits this and is misled or stuck

### 2.1 Paused studios lose their entire public profile

`src/app/studios/[slug]/page.tsx:77` gates on `status !== 'ACTIVE'`.

A studio paused for capacity or payment (`pauseCause: 'AT_CAPACITY' |
'PAYMENT_DUE'`) 404s. `pausedAt`, `pausedReason` and `pauseCause` all exist on
`Studio` and are read by no customer surface.

The 404 is correct for `ONBOARDING`, `SUSPENDED` and `REMOVED` — that
reasoning is sound and documented. `PAUSED` is different: it is a live studio
that is simply full this month, and the honest page is "not taking work until
November", not a dead link.

### 2.2 Two quote surfaces, two pricing engines, one page

`StudioQuotePanel` (client, `first-quote`, no auth) and `StudioQuotation`
(server, `quoteBrief`/`price.ts`, sign-in gated) both render on the profile,
under different headings, in different design languages, with totals that can
disagree.

It also makes the sign-in gate decorative: `StudioQuotation` demands sign-in
directly below a panel that already showed a full quote to nobody in
particular.

**Being fixed in the redesign** — `StudioQuotePanel` survives.

### 2.3 `/compare` has no sticky `<thead>`

`src/app/compare/CompareClient.tsx:424`. Scroll past the first screen and the
studio names are gone while the price columns continue. The user is reading
four columns of money with nothing saying whose.

### 2.4 `/compare` has no mobile layout

Zero responsive utilities in the whole 580-line file. At 375px the sticky
line-item column plus one 13.5rem studio column leaves almost nothing, scroll
cues are suppressed by `.oi-rail`, and `MaterialPanel` at `max-h-[62vh]`
covers most of what is left.

**2.3 and 2.4 are being fixed in the redesign.**

### 2.5 The photo-pending stamp is unconditional

`src/app/studios/[slug]/page.tsx:255` stamps "Illustration · photo pending" on
every portfolio card regardless of `p.images` and `p.isRender` —
`types.ts:64` says `isRender` exists precisely to tell those apart.

This is the "a missing value renders as missing" rule inverted: a present
value rendering as missing.

**Being fixed in the redesign.**

### 2.6 `/prepare` is undiscoverable

Exactly one link to it exists: `ExpertForm.tsx:148`, the post-submit
confirmation. Not in the header, not on `/account`, not in any email.

A page whose own doc comment says it is designed to sit open for days has no
route back once the tab closes.

### 2.7 Empty portfolio has no empty state

`page.tsx:244` renders "**0** projects, with budgets and timelines attached."
above an empty list. `RosterList.tsx:147-161` does this properly; the profile
does not.

**Being fixed in the redesign.**

### 2.8 Invented brief fallbacks, shown as fact

`StudioQuotePanel.tsx:61-64` — `carpetAreaSqft: brief.carpetAreaSqft ?? 850`,
`bhk: ... ?? 2`. A visitor whose brief lacks an area is quoted for an 850 sqft
2 BHK with nothing saying the number was invented.

Same rule as 2.5, and the same rule `types.ts` opens with.

---

## P3 — dead code, inconsistency, polish

| # | Finding | Where |
| --- | --- | --- |
| 3.1 | `createShareLinkAction` / `revokeShareLinkAction` unreferenced anywhere; no share button exists, though `/shared/[token]` does | `src/app/compare/actions.ts` |
| 3.2 | Literal hex `#857b6f`, against the module's own "never a literal hex" rule | `CompareClient.tsx:112,356` |
| 3.3 | Three different button treatments for one design system — `oi-cta`, `Cta`, and raw `<Link>` with inline `background: var(--acc-btn)` | `CompareClient.tsx:557`, `ExpertForm.tsx` |
| 3.4 | ~~"Remove" and "Clear stars" under the 44px target~~ — fixed in the styling pass | `CompareClient.tsx` |
| 3.4b | `/expert`'s submit sits disabled below `minStudios`, which contradicts `CompareBar`'s own rule: *"A greyed-out button is a puzzle: it says no without saying why."* Compare states what is missing in words and renders no button; expert should do the same | `ExpertForm.tsx` |
| 3.5 | Room group header `sticky left-0` without `z-10` while row headers have it — visible z-order break on horizontal scroll | `CompareClient.tsx:450` |
| 3.6 | `MaterialList` fallback renders unknown specs as plain grey text, so "tap any material you do not recognise" is false for anything outside the 15-entry glossary | `CompareClient.tsx:72-76` |
| 3.7 | `generateStaticParams` is dead under `dynamic = 'force-dynamic'` | `studios/[slug]/page.tsx:40,42` |
| 3.8 | `compareQuotes`, the two-studio predecessor of `compareMany`, unused | `first-quote.ts:284-304` |
| 3.9 | `/tier` is orphaned — the quiz goes straight to `/match`, and nothing links to it but itself | `src/app/tier/` |
| 3.10 | `briefId()` calls `getCurrentUser()` a second time with `user` already in scope | `expert/page.tsx` |
| 3.11 | Disabled chips at `opacity-25` fall below readable contrast | `QuizClient.tsx` |
| 3.12 | `oi-studio-shell` is applied to an element and has no CSS behind it | `StudioShell.tsx` |
| 3.13 | No `loading.tsx` / `error.tsx` under `/studios` or `/compare`; `/compare` renders one blank frame after hydration | both |
| 3.14 | Corrupted sessionStorage is swallowed into `EMPTY_PROJECT`, so it reads as "you have no quotes" rather than an error | `project-store.ts` |
| 3.15 | Stars are written best-effort and never read back; private browsing loses them silently with no notice | `journey-repository.ts:203` |

---

## The placeholder architect

`ARCHITECT_IS_REAL = false`, and `/expert` renders a named person — Ira
Deshmukh — with a quoted sentence, 12 years and 68 briefs read, through
`architectFacts()`, then puts a small `Flag` underneath.

A name with hard numbers and a quote reads as real long before the flag does.
The honest form is to suppress the facts until the person exists, not to
footnote them.

Not filed as P1 only because it is already known and deliberate. It should not
survive launch, and the launch checklist should name it.

---

## Not a defect, worth recording

The three design languages map onto funnel depth **in reverse**: the deepest,
highest-intent pages (`/prepare`, `/account`, `/studios/[slug]`) are on the
oldest system, the middle of the funnel is on the document system, and only
`/match` has the newest. A customer walking the funnel changes visual language
three times and the last change is a downgrade.

That is what the current redesign is for. `docs/DESIGN-LANGUAGE.md` is the
target; this file is what the redesign is deliberately not touching.
