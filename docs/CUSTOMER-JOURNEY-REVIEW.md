# Customer journey review — does it find the right studio?

**29 September 2026, against `main` at `73a4a15`.**

This is a review of OneBrief → OneMatch → OneQuote → OneCompare → OneExpert
against one question: *does it find each homeowner the studio that fits them,
and tell them why?* It is the companion to `docs/FINDINGS.md`, which remains
the list of copy and UI defects; this document is about the machinery.

Method: every file on the path was read, and the journey was walked end to end
in fixtures mode (no database) at desktop width and at 375px — a 3 BHK in
Kharadi, 1,250 sq ft, **kitchen and wardrobes only**, Premium, two children, one
elderly parent, someone working from home, "finishing on time" ranked first,
"decide most things for me", moving in on 20 November. Findings marked
**(seen)** were reproduced in the browser, not only read in the code.

---

## 1. The verdict

The principles are right, and rarer than they look: unmeasured is not zero,
dislikes as a hard filter, zones rather than exact areas, a versioned engine,
a quote whose doubt is printed next to its total, the same lines across every
studio, no paid placement. Keep all of it.

The machinery under those principles does not yet use most of what the
customer tells us. **Of nine questions, three decide who ranks first for a real
studio** — the locality zone, the budget band, and the styles liked — with
scope and property type counted through the portfolio. The household, the
working style, the move-in date and three of the four ranked priorities change
nothing about who is shown or in what order. The quote ignores the scope, the
level of finish chosen and the household. Compare compares price alone, and on
today's rates there is no price difference to compare. Expert re-ranks from
scratch and throws the compared set away.

So today the promise — *the studio that fits you, and why* — is carried mostly
by copy, and in four places the copy claims work the engine does not do. The
fix is not more screens. It is making every answer do a job, collecting the
studio-side facts those answers must be matched against, and carrying one
thread from the brief to the introduction.

---

## 2. How it works today

| Step | Route · main files | What actually happens |
|---|---|---|
| **OneBrief** | `/quiz` · `app/quiz/QuizClient.tsx` | Nine screens. Written to `sessionStorage` (`oi.brief.v1`) on every change and to `Brief` per step (fire-and-forget). The live panel shows "N studios still match" as you answer. |
| **OneMatch** | `/match` · `modules/matching/score.ts`, `app/match/*` | Runs **in the browser** on the whole roster. Hard filters (active, verified, not paused, <40% of portfolio in a disliked style, minimum project ≤ 2× budget max, same zone), then six weighted factors normalised over what could be measured. Top 6 shown. Each card fetches a written read from `explainAction` (Claude, 9s timeout, rules fallback). |
| **OneQuote** | inside `/match` · `components/oi/QuoteFlow.tsx`, `modules/quotation/first-quote.ts`, `catalogue.ts` | Per studio, on request. A floor-plan gate (plan ±10% / measured kitchen ±12% / standard kitchen ±16%), a ~10-second build animation with a question to answer, then a room-wise document: the standard catalogue for the BHK, the studio's filed rate per line (placeholder archive medians if none), 7% fee, 10% off modular, 18% GST. |
| **OneCompare** | `/compare` · `CompareClient.tsx`, `compareMany`, `starred.ts` | Client-only, from the quotes in `sessionStorage`. Same lines side by side, materials under every price, "where the difference is", starred lines totalled with material caveats. |
| **OneExpert** | `/expert` · `expert/page.tsx`, `consultation/request.ts` | Sign-in required. Re-ranks the top 5 from the server brief and prices them with the **legacy** `quoteBrief` engine on `RateCardItem`. The customer picks studios, ticks questions (some derived from their quote spread), leaves contact details → `Consultation`. Ops runs the call and makes the introduction. |

---

## 3. What is right — keep it

- **`null` is not zero** (`score.ts`). A cold-start studio is "matched on 4 of 6", never a borrowed 94%. The card prints "N of 6 factors". This is the brand and it is implemented properly.
- **Dislikes rule studios out** rather than lowering them, and the reasoning quotes the true share ("about 20% of their work leans that way") instead of "none".
- **Zones, not exact areas**, with the reason written down. Right call at 64 localities.
- **Versioned engine** (`ENGINE_VERSION`), so a stored score is never silently reinterpreted.
- **The quote prints its doubt.** The band width depends on what we know, and every assumption is listed under the total.
- **Same lines, same sizes, their own rates** — the comparison is structurally fair, and the material glossary makes a spec readable.
- **Starring with caveats** — "cheaper" never travels without the material differences behind it.
- **The written read is fenced**: facts we hold only, banned marketing words, and a label that says whether a model or a rule wrote it.
- **Expert derives questions from the customer's own spread** — the right instinct, and the pattern to extend.
- **No money moves ranking.** `tiers.ts` takes no subscription argument, on purpose.

---

## 4. What is wrong

### 4.1 Every answer, and what it changes

| Q | Answer | Changes the ranking? | Changes the quote? | Reaches the written read? |
|---|---|---|---|---|
| 1 | Property type | Scope-experience factor (exact match on portfolio) | Yes — rooms, bathrooms, kitchen run | Yes |
| 1 | Locality | **Zone** hard filter only. The exact area appears in the text but is **not scored**, although `score.ts:158–161` says it is "a scoring bonus" | No | Yes |
| 1 | Carpet area | Budget band size | Per-sqft lines; **850 sq ft if blank, for any BHK** | Yes |
| 2 | Scope | Scope-experience only | **Ignored — always the full home** **(seen)** | Yes |
| 3 | Level / budget | Budget fit (vs *absolute* project values) + hard filter | **Ignored** | Max only |
| 4 | Styles liked | Style overlap, 25 — and again as the DESIGN_AMBITION priority | No | Yes (as slugs) |
| 5 | Styles ruled out | Hard filter above 40% | No | Yes |
| 6 | Household | **Nothing** | **Nothing** | **Not sent** |
| 7 | Priorities, ranked | **Only #1**, and it re-counts an existing factor. SPEED and MATERIAL_QUALITY are `null` for every real studio | No | **Dropped by the sanitiser** |
| 8 | Involvement | Working-style factor — needs `autonomyProfile` and `communicationRating`, **which nothing in the app ever writes**; only the fixture seed sets them. `null` for every real studio | No | Not sent |
| 9 | Move-in date | **Nothing** | No | Not sent |

For a real studio today the score is **style overlap + budget fit + scope
experience**, with one of the three counted twice by the priority factor.
Questions 6, 8 and 9, and three-quarters of 7, are asked, stored, handed to the
studio — and play no part in finding them.

### 4.2 Correctness — the product says something untrue

| # | What | Where | Why it matters |
|---|---|---|---|
| 1 | **Scope is ignored by the bands and the quote.** Kitchen & wardrobes on 1,250 sq ft is offered ₹8.75L–₹40L whole-home bands, then quoted ₹15.5L including beds, false ceiling, painting, electrical, a TV unit and a safety door **(seen)** | `tiers.ts` `tierRangeFor`, `first-quote.ts` `itemsFor` | The first number a kitchen customer sees is 3–4× their job. They leave, or they carry a wrong budget into every studio conversation |
| 2 | **The floor-plan path claims a measurement it never took.** Uploading only records the file name; the quote uses the standard run at the ±10% band and prints "read from your floor plan". The animation says "Reading your floor plan" even when there is no plan **(seen)** | `QuoteFlow.tsx:117`, `first-quote.ts:161,263`, `Building.tsx:64` | A false statement on the document whose whole claim is that it tells you what it assumed |
| 3 | **Two different percentages for one studio.** Card: 55%. The sentence under it: "53% match — because…" **(seen)** | `sanitise.ts` drops `priorityRanking`; the server re-scores a different brief | The one number the customer is told to trust contradicts itself on the same card |
| 4 | **Q9 promises a warning that does not exist.** "If your date is tighter than that, we'll say so." A 52-day move-in for a full-home quote produced no warning anywhere **(seen)** | `QuizClient.tsx:626`; no reader of `moveInBy` in matching or quoting | A promise broken in the first two minutes |
| 5 | **The match page claims inputs it does not score.** "Scored on your answers — locality, scope, budget band, style, household — and on how many of the 15 checks they have cleared." Household is not scored; checks are not a factor **(seen)** | `MatchHero.tsx:65` | Same class as FINDINGS 1.1 |
| 6 | **Two quiz hints overclaim.** Q6: "This drives the practical side of the match." Q7: "This single answer does more matching work than any other" (it is a 10% factor that re-counts another) | `QuizClient.tsx:754,817` | — |
| 7 | **Budget is compared in the wrong unit.** Bands are ₹/sq ft (the business defines them that way); budget fit compares the band's total against a studio's **absolute** delivered project values. A studio that does ₹25L 4 BHKs looks "out of range" for a ₹2,000/sq ft 2 BHK | `score.ts` `scoreBudgetFit` | Ranks studios on home size, not on price level |
| 8 | **Placeholder rates make compare meaningless.** Two fixture studios: ₹15.53L vs ₹15.48L, every line a few hundred rupees apart, every material identical **(seen)**. Real studios without live filed rates get the same placeholder table | `resolve-rates.ts`, `data/filed-rates.ts` | The step exists to show real differences; today it shows noise. It also breaks "never quote a studio on someone else's rates" |
| 9 | **Expert discards the journey.** It re-ranks the top 5 and re-prices with the legacy engine, ignoring the studios compared and the quotes seen — and silently redirects to `/match` if no ranked studio has a complete legacy rate card | `expert/page.tsx:52` | The customer's shortlist, built over three screens, is not the one the expert sees |
| 10 | **Nothing is learned.** `storeMatches` has no callers, so the `Match` table is empty — no record of what we showed whom, and the studio dashboard and ops allocation read 0 | `matching/store.ts` | No feedback loop is possible without it |
| 11 | **`/match` forgets you on a new tab or device.** It reads `sessionStorage` only | `MatchClient.tsx:81` | The brief is on the server; the page does not ask for it |
| 12 | Locality text reads "Nibm", not "NIBM Road" | `score.ts:406,476` use `titleCase` not `localityLabel` | — |

### 4.3 Design problems — nothing is broken, but it is not good enough

- **The style picker cannot carry taste.** Twelve flat vector rooms; "Contemporary Minimal" and "Scandinavian" are near-identical drawings **(seen)**. Taste lives in photographs — material, light, clutter — and an illustration strips exactly that out. The style is the single largest factor (25), so this is the largest source of error in the match.
- **Styles are all-or-nothing.** A Japandi customer scores zero against a Scandinavian-heavy studio. Neighbouring styles get no partial credit.
- **Studio style tags are self-declared** per project in onboarding and never checked.
- **Unequal evidence ranks as equal.** A studio scored on 3 factors can outrank one scored on 6 on the strength of the three it happened to have. The honest *display* is right; the *ranking* needs to account for how much we know.
- **Quoting is one studio at a time, ~10 seconds each.** Pricing three studios is three round trips and half a minute of animation, for a computation that is instant and deterministic. `journey.ts` calls OneQuote "Instant".
- **No way out of a thin result.** "Nobody fits" offers "Change your answers", which restarts the quiz — rather than "include the neighbouring zone (+3 studios)" or "include one band up (+2)".
- **Step 1 on a phone is 3.3 screens tall**: five large tiles, then 64 locality chips in one wrap, then the area field; Continue is greyed until a locality below the fold is found **(seen)**. The zone grouping exists (`LOCALITIES_BY_ZONE`) and is flattened.
- **The area default ignores the BHK.** A 4 BHK with no area is priced as 850 sq ft.
- **The level of finish does not shape the quote.** A Premium customer matched to a studio whose rates land in Luxury is shown the Luxury figure with no word that it sits above the band they chose.
- **Compare is price-only.** The decision is a designer, not a price list: fit, delivery record, work like theirs and working style are absent from the one screen built for deciding.
- **The written read sees less than the card.** No household, priorities, timeline or involvement; no portfolio project details. It cannot say "your two children and the home office" because it is never told.
- **Expert asks again.** Name, phone, email, and a free-text box whose placeholder is "We have a two-year-old, so timeline matters more to us than finish" — both facts the brief already holds.

---

## 5. How to make it personal — honestly

Two rules keep this on-brand:

1. **Personalise only on facts we hold, and show which fact did the work.**
   "Ranked up because you put *finishing on time* first and their last six
   homes averaged four days late" — never "handpicked for you".
2. **Every question must change at least one of: who is shown, in what order,
   what is priced, what is said.** A question that changes none of them is
   removed or rebuilt.

### 5.1 Make each answer do its job

| Answer | What it should do |
|---|---|
| **Scope** | Bands and quote lines per scope: kitchen & wardrobes prices the kitchen and bedroom storage only; one room prices that room; renovation adds a civil block. Budget fit compares against the studio's projects of the same scope. |
| **Area** | Default by BHK (e.g. 1 BHK 550, 2 BHK 800, 3 BHK 1,150, 4 BHK 1,600 — calibrate from the archive), printed as assumed. |
| **Level / budget** | Compare in ₹/sq ft: add carpet area to portfolio projects (onboarding already takes value and duration), so a studio's delivered rate sits beside the band's. Once filed rates are live, price the customer's own home with them and say where it lands: "prices at Luxury for your flat — above the Premium you chose". |
| **Priorities** | Use the whole ranking as weights (for example ×1.6 / ×1.3 / ×1.0 / ×0.8 on the factors each maps to), and map each to its own signal instead of re-counting another factor. **Budget** → budget fit plus where their price sits in the band. **On time** → timeline feasibility (below) plus delivery record when measured. **Design ambition** → depth of work in the liked styles, share of custom work, Luxury-band projects. **Material quality** → the spec level of their filed rates (BWP vs MR, hardware brand) until spec compliance is measured. |
| **Household** | Match on declared and demonstrated specialisms — children (storage, safe edges), elderly (anti-skid, grab bars, bed heights), pets (scratch-resistant finishes), home office (a designed workstation). Add the matching lines to the quote (a study for WFH is already in the catalogue). Tell the written read. |
| **Involvement** | Ask studios how they work (next section) to fill `autonomyProfile`; fill `communicationRating` from a two-question check-in after the introduction. Until then, say the factor is not measured — it already does. |
| **Move-in date** | Feasibility per studio: today + their current lead time + their typical duration for this scope (from portfolio `durationDays`) vs the date. Warn on the card, sort infeasible studios down, never hide them silently; if nobody can make it, say so once at the top. This keeps the promise on Q9. |
| **Locality** | Make exact-area experience a small real score component, as the comment already claims it is. |

### 5.2 Style — the biggest lever

- **Real photographs, not drawings** — three per style, ideally from roster portfolios with consent, so picking an image is picking real Pune work.
- **A second round of "this or that"** between the two closest styles picked. Pairwise choices separate neighbours far better than "pick three".
- **A style-affinity table** (12×12, hand-set, versioned with the engine) so neighbours earn partial credit: Japandi ↔ Scandinavian ↔ Warm Modern.
- **Check the studio's tags**: tag portfolio photos with a vision model, have ops confirm, flag disagreements. Weight recent work above old.
- **Lead with their work that looks like yours.** On each card, show first the two or three projects closest to the brief (style, BHK, zone). `ProjectWings` already renders the portfolio — sort it by similarity.

### 5.3 Ranking that is honest *and* good

- Keep the displayed score exactly as it is. **Rank** by a confidence-adjusted score: pull each studio toward the roster average in proportion to the weight we could not measure. A 3-of-6 studio no longer outranks a 6-of-6 on thin evidence. Bump to `match@1.1.0`.
- Explicit tie-breaks (measured weight, then verification checks, then delivery record), not roster order.
- **Store every match** with its engine version. Nothing below in §5.8 works without it.

### 5.4 The match screen

- **Price the top matches at once.** The computation is instant; keep the build animation for the first quote only.
- **Show the evidence per factor**, in the customer's words: "You said: on time first → their last 6 homes averaged 4 days late."
- **A "why not higher" line** from the weakest factor. The written read does this; make the rules sentence do it too, and make both use the same score.
- **Relax one constraint** when fewer than three studios fit: "Include West Pune (+3)", "Include one level up (+2)", with the count shown before they tap.
- **A timeline flag** on every card (from §5.1).

### 5.5 The quote

- Scope-aware lines, household-aware rooms (§5.1).
- **Read the floor plan for real.** The archive pipeline already sends PDFs and photos to Claude and parses the answer defensively; point the same machinery at a floor plan for the kitchen run, room count and carpet area, and show what was read for the customer to confirm. Until that ships, the plan button must not claim a measurement (bug 2).
- Say where the quote lands against the band they chose.

### 5.6 Compare

- **A "fit" block above the price table**: score and factors, delivery record, projects like theirs, working style, timeline fit, checks cleared. Price second.
- **Compare materials on normalised ids**, not sentences (FINDINGS 1.2).
- **A grounded written summary.** `summarise()` exists in `quotation/summary.ts` and compare does not use it: "Akara is ₹38,000 dearer, all of it in the kitchen, where they quote veneer against laminate."
- Until real rates exist, **lead with fit**, and let the placeholder flag stay loud.

### 5.7 Expert

- **Carry the thread**: the studios compared, the exact first quotes (`FirstQuote` rows), the starred lines. Retire the legacy `quoteBrief` path from this page.
- **Never ask twice**: prefill contact from the account; derive questions from the household and the date as well as the spread.
- **A one-page pack for the architect** — answers, match reasoning per studio, quotes, stars, derived questions. `/ops/consultations` already has a prep pack; extend it.
- **Record the choice and the reason** after the call.

### 5.8 Continuity and learning

- `/match` falls back to the server brief when `sessionStorage` is empty.
- One journey record per customer: brief → matches shown (with engine version) → quotes (with correct rate provenance — `RATES_VERSION` is stamped wrongly today) → compared → consultation → introduction → outcome.
- **Close the loop.** Two questions after the first meeting (did the studio match what we said? how was the communication?) fill `communicationRating`; delivery against the milestone plan fills reliability. This is how factors move from `null` to measured.
- Weights change only through an `ENGINE_VERSION` bump, reviewed against outcomes. No ML before the 500-project threshold `score.ts` already sets.

---

## 6. What studios must give us

Personalisation on the customer side is matching against facts on the studio
side. Most of these are one question in onboarding, and each one is also a
selling point to the studio: *it is how you get leads that fit.*

| Signal | Feeds | Where it would come from | Today |
|---|---|---|---|
| Carpet area per portfolio project | ₹/sq ft budget fit | Onboarding portfolio step (one field) | Not collected |
| How they work (turnkey / collaborative / client-led; update cadence) | Involvement → working style | Onboarding question | `autonomyProfile` exists, never written |
| Specialisms and per-project tags (children, elderly, pets, WFH, vastu) | Household fit | Onboarding + portfolio tags | Not collected |
| Current lead time | Timeline feasibility | Studio settings / ops allocation | Capacity exists; lead time does not |
| Typical duration by scope | Timeline feasibility | Portfolio `durationDays` | Collected, unused |
| Filed rates, with spec level | Real quotes; material-quality priority | Archive pipeline (PENDING → LIVE) | Built; `ratesAreReal()` is false |
| Checked style tags | Style overlap | Vision tagging + ops confirm | Self-declared |
| Post-introduction feedback | Communication rating | Customer check-in | Not built |

---

## 7. Suggested order

Sizes are relative: **S** a day or less, **M** a few days, **L** a week or more.

**Phase 0 — make it true.** Nothing new; stop saying untrue things.
Bugs 2, 3, 5, 6, 11, 12 from §4.2 (S each). Area default by BHK (S). The Q9
promise either kept or removed (S to remove; kept in Phase 1). Scope-aware
bands and quote lines (M) — or, if non-full-home work is not the launch
market, remove those scope options (S).

**Phase 1 — make every answer count.** Full priority ranking with distinct
signals, timeline feasibility, household into quote rooms and the written read,
₹/sq ft budget fit, confidence-adjusted ranking, exact-locality component,
storing matches. One engine bump, `match@1.1.0`, with tests for each factor (L).

**Phase 2 — studio-side facts.** The onboarding additions in §6, and style-tag
checking (M–L). Needs the studio flow, so it is its own branch.

**Phase 3 — the experience.** Photographic style picker with the pairwise
round (M, plus photography), price-all on `/match` (S), relax-a-constraint (M),
compare fit block and summary (M), expert continuity and the architect's pack
(M), step 1 rebuilt for phones (S).

**Phase 4 — the loop.** Journey record, post-meeting check-in, outcome review
(M).

---

## 8. Decisions that are yours

1. **Is anything other than a full home a launch market?** If not, removing
   the three other scopes is the cheapest correct fix. If yes, scope-aware
   pricing is Phase 0.
2. **Photography for the style picker** — roster portfolio photos (needs each
   studio's consent) or licensed images?
3. **Move-in date: warn, or filter?** Recommended: warn and sort down, never
   hide.
4. **Does a studio sit in one band, or file rates per band?** It decides
   whether a Premium customer can see a Luxury studio's Premium price.
5. **How many matches**: six today. Scarcity is part of the pitch; three to
   five with a "see more" is worth considering.
6. **Which band scale is canonical** — `tiers.ts` (₹700–3,200/sq ft) or the
   studio deck (₹1,200–2,500+)? The customer bands and the studio bands must
   be the same bands.
