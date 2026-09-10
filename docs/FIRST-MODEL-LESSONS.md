# What the Hauspire first-quote builder got right

Written 10 September 2026, after reading the first model's source and calibration
docs (`hauspire-app/src/lib/*`, `ocrPlan.ts`, `Plan2D.tsx`, and the three
`First_Quote_*.md` files).

That tool is **more accurate at estimating an Indian interior project than One
Interiors currently is**, and it earned that accuracy against four real
quotations reconciled to the rupee. This document is what to take from it, what
to leave, and why.

## The one thing to understand before reading the rest

The two products have different jobs, and that changes what "port" means.

- **Hauspire's tool** produces *one studio's own quote*, using that studio's
  rates, for a designer who will edit it.
- **One Interiors** produces *several studios' quotes side by side*, each from
  that studio's own rate card, for a customer who cannot edit any of them.

So the **structure** of the first model is portable and most of it is better
than ours. The **numbers** are not, and never will be — a rate card belongs to
the studio that wrote it, and `price.ts` has no default and no fallback
precisely so that stays true. Everything below is about mechanism.

---

## 1. The two-numbers insight — the most valuable thing here

**What it is.** A first quotation for an Indian flat is reproducible from two
inputs: the **BHK** and **one kitchen run length in mm**. Everything else —
wardrobe 1800×2100, kids' wardrobe 1500×2100, loft height 600, TV unit
1800×2100, mandir 600×1800 — is fixed by convention and does not move with the
size of the flat.

**Why it matters to us.** `estimate.ts` currently derives every quantity from
carpet area alone, then widens a variance band to cover being wrong. The first
model shows that is the wrong axis. Carpet area is a weak predictor of carpentry
because the carpentry is standard-sized; what actually varies is the kitchen.

Validated end to end on four real quotes, feeding only kitchen run + BHK:
**−1%, +1%, −5%, −14%**. Our own bands are ±15% before we assume anything.

**What to do.** Add kitchen run as a first-class brief field, and move the
fixed-size items out of per-sqft blending into named standard dimensions. The
±15% base variance is defensible only while we are guessing at things this tool
does not have to guess at.

## 2. Four sizing kinds, not one rate per category

**What it is.** Every line carries a `kind`:

| kind | meaning | example |
| --- | --- | --- |
| `run` | width = the kitchen run, height fixed | Base cabinets, W = run, H = 750 |
| `fixed` | both dimensions hardcoded by room | Master wardrobe 1800×2100 |
| `unit` | flat rupee amount, dimensions irrelevant | Beds, painting, electricals |
| `perbed` | unit amount × bedroom count | False ceiling per bedroom |

**Why it matters.** Our `categories.ts` has one rate shape per category and
multiplies by an estimated quantity. That cannot express "this item is always
1800mm wide regardless of the flat", which is most of the carpentry.

**What to do.** This is the shape a studio rate card should take when we rebuild
onboarding's rate step. It is also the honest answer to why two studios' quotes
differ: not a mystery, but a different standard wardrobe width.

## 3. Area vs Unit is decided by rate consistency, not by whether dimensions exist

**What it is.** From the enrichment notes: for every product, compute ₹/sqft
across thousands of dimensioned lines. If the interquartile spread is **≤30% of
the median**, it is genuinely area-priced. Otherwise it is unit-priced — *even
though the lines carry width and height*.

**Why it matters.** It catches a trap we would walk straight into. A 750×200
workstation line computes to about ₹7,400/sqft, which is nonsense; the item is
really ₹12,000 flat. Naive logic — "it has W and H, so price by area" — produces
a confidently wrong number.

**What to do.** When a studio enters a rate, we should be asking which of the
two it is, and we should sanity-check their answer against this test once we
have enough lines. This is exactly the kind of check that makes our published
variance figures worth something.

## 4. Two modular rate bands, not one

**What it is.** From 25,581 line items across 940 quotes, modular carpentry
splits cleanly:

- **~₹2,065/sqft** — vertical modular: wardrobes, wall cabinets, tall units,
  bookshelves.
- **~₹1,850–2,035/sqft** — base cabinets, lofts, dry-balcony base, console,
  shoe rack, mandir.

That replaced a single blended "house rate" of ~₹2,580 guessed from four
quotations.

**Why it matters.** Our tier bands (700–1100, 1100–1800, 1800–3200 per sqft) are
whole-project figures. This is the line-level structure underneath them, derived
from real data at a scale we do not have and will not have for a year.

**Do not copy the numbers into any studio's rate card.** They are Hauspire's.
Use them to sanity-check the *shape* of what a studio gives us — a studio
quoting one flat rate for all modular work is telling us something.

## 5. The kitchen-run heuristic

```
run = max(600, width_mm + depth_mm − 900)
```

An L-kitchen bounding box minus a 900mm corner allowance. Validated: a 10'×10'2"
kitchen modelled at 5,247mm against an actual 5,240mm. Seven millimetres.

Worth porting verbatim, with its 900mm constant and its `max(600, …)` floor.

## 6. Free client-side floor-plan OCR that already works

**What it is.** `ocrPlan.ts` — Tesseract in the browser, no API key, no cost.
Rasterises page 1 of a PDF via pdf.js, upscales to ~2200px, greyscales,
**Otsu-binarises**, then runs OCR in sparse-text mode. Parses `10'0"X10'2"`
tolerantly (the regex accepts `º` and `o` for the foot mark, because OCR
mangles it), maps labels to room types, and derives BHK, bathroom count,
balcony, study.

**Why it matters.** Our partner brief promises floor-plan upload at step 1 and
we have not built it. This is a working implementation, and it is the single
biggest lever on quote accuracy we have — it is what turns "±22%, tell us your
carpet area" into a real kitchen run.

**The two details worth copying exactly:**

- **Otsu binarisation is the accuracy win.** Tesseract reads clean black-on-white
  far better than a photo. This is most of the difference between working and
  not.
- **It returns `null` when it cannot read enough**, and carries a
  `confidence: 'high' | 'medium' | 'low'`. It refuses rather than inventing —
  the same rule as `price.ts` having no fallback rate.

## 7. Human-in-the-loop as a hard rule

Every one of the first model's docs repeats it: extraction output is **shown to
the designer to confirm or edit before anything is built**. Never applied blind.
The stated reason is good — plans usually do not show whether the kitchen
platform is straight, L or U, so the run is a proposal, not a fact.

For us the reason is stronger. A number we extracted from a customer's plan and
used without showing them is a number we cannot defend when the site visit
disagrees. Whatever we read off a plan goes on screen, labelled as ours, editable
in one tap — the same treatment `/tier` now gives an assumed carpet area.

## 8. Editable line amounts

`QuoteTable.tsx` makes every amount a live input, highlighted, with the line
removable. The designer overrides anything.

**This does not port to the customer side** — a customer editing a studio's
quote is meaningless. It ports to **studio onboarding and to ops**: when a
studio disputes what we generated from their rate card, the fix is to let them
correct the line and tell us why, not to argue about the rate.

## 9. A real milestone payment schedule

Booking advance **₹25,000 flat** (refundable within 3 days), then, as
percentages of the balance: Design Advance 5%, Design Closure 10%, Material
Procurement 40%, Material Dispatch 40%, Project Handover 5%.

We talk about milestone plans as our core promise and have no concrete schedule
anywhere in the product. This is one, in use, from a real studio.

## 10. The MO / NM split is load-bearing

Lines are tagged `MO-01` (modular) or `NM-01` (non-modular), and:

```
fee      = (MO + NM) × 7%
discount = MO × 15%          ← modular only, not NM, not the fee
TPV      = MO + NM + fee − discount
```

The 15% applies **only to modular**. The first prototype omitted it, and every
one of the four real quotes failed to reconcile until it was added.

**Why it matters to us.** If studios discount this way and we model a flat
discount — or none — our numbers will differ from the quote the customer is
eventually handed, and we will have no explanation. Worth asking Hauspire and
Urbanline directly whether they discount modular separately.

## 11. Calibrating against real quotes, to the rupee

This is the practice worth stealing, more than any single formula. Four real
quotations were reverse-engineered until the model reproduced each total exactly
— ₹8,98,205, ₹12,74,758, ₹13,86,794, ₹9,43,734. That is what surfaced the
missing 15%.

We have 980 real Hauspire quotations available. Once a studio's rate card is in,
we should be able to point our engine at a project they actually quoted and see
how close we land. Any gap is either our bug or a designer add-on, and both are
worth knowing before a customer sees the number.

The first model's own handling of its worst miss is the right instinct: the −14%
was not written off as noise, it was traced to four named add-ons a first draft
correctly should not include.

## 12. Plan2D — a spatial read of the quote

Worth being precise, because the name misleads: **it is not a floor plan.** It
takes the built line items and draws one coloured box per room in a fixed
3-column grid, each showing the room subtotal and its first six items. It has no
access to real geometry; the code comment says so and calls itself a stand-in.

Even so, it is a good idea we do not have. For us the stronger version is on
`/compare`: the same room boxes across two studios side by side, so a customer
sees at a glance that one is dearer in the kitchen and cheaper in the bedrooms.
That is our compare table made spatial, and it needs no plan geometry at all.

---

## What NOT to bring across

**Hauspire's rates.** Non-negotiable, and already enforced: `price.ts` has no
default rate, and `seed-rate-cards.ts` refuses real studios by name. The bands
in §4 are for sanity-checking shape, never for seeding a studio's card.

**The absent GST.** The first model has no tax line at all — its 7% is a
professional fee. We charge 18% GST and show it. Keep ours.

**Two bugs, if any code is lifted:**

- `types.ts` declares `details`, `buildQuote.ts` reads `it.details`, and every
  entry in `template.json` uses `det`. Every built line's `details` is
  `undefined` at runtime.
- The calibration doc recommends "current standard" rates (Base ₹2,542, Wardrobe
  ₹2,581) over archive medians, but the shipped `productMaster.json` still
  carries the medians (Base ₹2,035, Wardrobe ₹2,065). The recommendation appears
  never to have been applied — so anything derived from that file under-quotes
  carpentry by roughly 20%. **Our `pilot-rates.ts` was derived from this same
  file**, and should be re-checked against it.

---

## Suggested order

1. **Floor-plan upload with OCR** (§6, §5, §7) — wire `ocrPlan.ts` into quiz
   step 1, show what we read, let them fix it. Biggest accuracy gain available,
   and the code already exists.
2. **Kitchen run in the brief, and the four sizing kinds** (§1, §2) — the
   estimator change that makes the OCR worth having.
3. **Ask both pilot studios about the modular discount** (§10) — a question, not
   a build, and it changes whether our totals match theirs.
4. **Calibrate against real Hauspire quotations** (§11) — once a rate card is in.
5. **Milestone schedule** (§9) and **room boxes on compare** (§12) — both
   product wins, neither urgent.

Items 1 and 2 together are what would let us honestly narrow the ±15% base
variance, which is the number a customer feels most.
