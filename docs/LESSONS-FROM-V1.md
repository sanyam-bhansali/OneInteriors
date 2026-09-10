# What the first build got right

Read from the source of **Hauspire Quotation Studio** (`Quotation automation/Quotation hosted`),
not from a demo of it. Everything below is a thing that build does and One Interiors does not,
with the reasoning for why it matters here and what it would take.

One important framing before the list. The two products are not the same shape. V1 is a **tool for
a designer**, used by someone who knows the catalogue, sitting with a client. One Interiors is a
**marketplace for a customer**, used by someone who has never bought interiors before and does not
trust anyone in the category yet. So a few things that are right in V1 would be wrong here, and
one of them is at the bottom marked *do not copy*.

Ordered by what I would build first.

---

## 1. Floor-plan OCR that pre-fills the brief

**What V1 does.** `src/lib/ocrPlan.ts` takes an uploaded plan — image or PDF — rasterises it,
preprocesses it (upscale, greyscale, Otsu binarisation), runs Tesseract in sparse-text mode, and
pulls out a room list with real dimensions in millimetres, a bathroom count, a balcony and study
flag, a BHK, and a kitchen run. Entirely in the browser. No API key and no per-use cost.

**Why it is better than what we have.** Our `OneBrief` step promises floor-plan upload on the
landing page and in the partner brief, and does not have it. That is the second-worst kind of gap:
a promise made where the customer can see it. More concretely, `narrowing.ts` already tells every
customer that a floor plan is the last thing that tightens their quote before a site visit — so we
are naming a lever we do not offer.

The accuracy gain is real, not cosmetic. `estimate.ts` widens the variance band by ten points when
carpet area is guessed and fifteen when property type is. A plan supplies both, plus a per-room
breakdown we currently have no way to obtain. A quote at ±15% instead of ±40% is a different
product.

**What to take, precisely.** Three design decisions in that file are worth copying verbatim:

- **It returns `null` when it cannot read enough** (`if (!kitchenRun && rooms.length < 2) return null`).
  It does not guess. That is the same rule as `price.ts` refusing to quote a studio with no rate
  card, and it is why the output can be trusted.
- **It carries a `confidence` of high / medium / low**, and the README says the designer confirms.
  We would show the extracted rooms back to the customer to correct — which is also a good moment
  psychologically, because it proves we read their plan.
- **Sanity bounds on every number** — a room dimension outside 600–12,000mm is discarded, a kitchen
  outside 2,000–4,600mm sets `runOk = false` rather than producing a wrong run. Bad OCR is silent
  otherwise.

**Cost.** Moderate. `tesseract.js` and `pdfjs-dist` are both browser-side, so nothing touches our
server and no key is needed. The Supabase `floor-plans` bucket is already written
(`src/modules/storage/floor-plan.ts`) and just needs creating.

---

## 2. Quotes broken down by room, not only by category

**What V1 does.** Every quote line carries a `room` — Master Bedroom, Kids Bedroom, Living/Dining,
Other Services — and products sit inside rooms.

**Why it is better.** Ours are grouped by trade category: modular kitchen, wardrobes, false ceiling,
painting. That is how a contractor thinks. A customer thinks in rooms, and more importantly
**decides in rooms.** The single most common way an interiors budget gets closed is "let's do the
bedrooms now and the living room next year" — and our quote gives them no way to see what that
costs or to ask for it.

It also makes the comparison sharper. "Studio A is dearer" is weak; "Studio A is dearer on the
kitchen and cheaper on both bedrooms" is a reason to pick one. `compareQuotes` already does this
per category; per room it would read like something a person would actually say.

**Cost.** Medium, and it touches the schema — `QuotationLineItem` needs a room, and `estimate.ts`
needs to emit quantities per room rather than per category. Worth doing before the rate-card format
is locked with real studios, because retrofitting it afterwards means re-asking Hauspire and
Urbanline for their data in a new shape.

---

## 3. Payment stages on the quote

**What V1 does.** `computeTotals` returns `stages`, and `Totals.tsx` prints them under the total.

**Why it is better.** This is the biggest single gap on the list relative to our own positioning.
The whole One Interiors argument is that we hold a project to a **milestone plan** — it is on the
landing page, it is in the partner brief, it is the thing the escrow work eventually rests on. And
the quote, which is the only document a customer actually studies, says nothing about it.

A customer comparing four quotes at similar totals has no way to see that one studio wants 70% up
front and another wants 40%. That difference matters more than a two percent price gap and is
exactly the sort of thing that predicts a project going wrong. We should be showing it and V1
already computes it.

**Cost.** Low, if studios enter their stage structure during onboarding — which is one more field
on a form they are already filling in. This is the best effort-to-value ratio on the page.

---

## 4. Modular vs non-modular split in the pricing model

**What V1 does.** `TPV = (MO + NM) + 7% fee − 15% discount on modular`. Modular and non-modular are
tracked separately all the way through, because **the discount only applies to one of them**.

**Why it is better.** Our `price.ts` has no such split, which means we cannot reproduce a studio's
own pricing rule. We already know this specific rule is real — `pilot-rates.ts` records
Hauspire's rates as post-discount figures precisely because we could not model the discount
properly. That is a workaround, and it means the numbers we show cannot be reconciled line-by-line
against the studio's own quotation.

For a product whose position is "the number you see is the number they would have charged you", not
being able to reproduce the studio's arithmetic is a structural weakness, not a detail.

**Cost.** Low-to-medium. A boolean on the rate category and the fee/discount order made explicit in
`price.ts`, with tests pinning the arithmetic against a real Hauspire quotation.

---

## 5. A spatial view of the quote

**What V1 does.** `Plan2D.tsx` draws each room as a labelled box with its own subtotal and the
products inside it, as an SVG.

**Why it is better.** It turns a table into something you can look at. Money laid out over rooms
answers "where is it all going" in about two seconds, and it makes the drop-a-room decision above
visible rather than arithmetic.

Note honestly what it is: V1's version is schematic, a grid of equal boxes, not the real plan. The
comment in the file says so. But combined with item 1, the real geometry becomes available — and a
quote drawn on the customer's actual floor plan, with each room's cost in it, is a thing no
competitor in Pune is showing anyone.

**Cost.** Low for the schematic version, which we could ship immediately. Higher for real geometry,
and it should wait until OCR is landing reliably.

---

## 6. Revisions as a first-class object

**What V1 does.** The dashboard lists past quotations with a **Revise →** button that loads the old
quote into the builder as a new draft, carrying `fromId`. The roadmap names a Revised-vs-Final
comparison.

**Why it is better.** We already store every quote we generate — `storeQuotes` writes them and
`quoteHistory` reads them back — and we never show a customer any of it. The partner brief promises
"quotation revisions" in the portal.

The reason it matters is specific to our position: an interiors quote that changes is the single
loudest complaint in the category. A customer who can see version 1 next to version 3, with what
moved, is holding the thing that makes the complaint impossible to hide. That is our whole argument
delivered as a feature rather than a claim.

**Cost.** Low. The data is already there. This is mostly a page.

---

## 7. A per-room default template, calibrated against real quotes

**What V1 does.** `data/template.json` holds a default set of products per room type, described in
the README as "calibrated to real quotes". That is what lets a 3 BHK become a full line-item draft
without a designer touching it.

**Why it is better.** Our `estimate.ts` derives quantities from carpet area and property type, which
is defensible but coarse. A template calibrated against 980 real Hauspire quotations is a much
stronger prior, and it is an asset nobody else in Pune has.

**The governance line, which matters here.** The template may encode **structure** — which products
a bedroom normally contains, in what quantities. It must never carry **prices**. That is the exact
distinction already written into the Hauspire governance table in the partner brief: their
quotation structure is fair game, their rates are not, and no studio's rate card may be seeded from
another's. Keep the template as quantities and let each studio's own card price it.

**Cost.** Medium, and mostly analysis rather than code.

---

## Do not copy: the on-spot discount field

`Totals.tsx` has an **On-Spot Discount (₹)** input the designer can type any number into, alongside
an editable discount percentage.

In V1 that is correct. It is a tool for a salesperson sitting across a table who has authority to
close a deal.

In One Interiors it would be poison. A price that moves when someone pushes is precisely the
behaviour our whole position is built against — the landing page says nothing is added to a quote
and that no studio can pay for position, and a visible "we can knock a bit off" lever tells the
customer the first number was never real. It would also make the published variance figures
meaningless.

If studios want to discount, it belongs in their rate card, where it applies to everyone and where
we can show it consistently. The distinction is worth stating out loud in the studio agreement.

---

## Suggested order

| | Item | Effort | Why now |
|---|---|---|---|
| 1 | Payment stages | Low | Closes the gap between our loudest promise and our main document |
| 2 | Revision history page | Low | Data already exists; it is our core argument made visible |
| 3 | Modular/non-modular split | Low–Med | Blocks reconciling our numbers against a studio's own quote |
| 4 | Floor-plan OCR | Med | Biggest accuracy gain; also a promise we are already making |
| 5 | Room-level quote lines | Med | Do it before rate-card formats are locked with real studios |
| 6 | Plan2D (schematic) | Low | Cheap once rooms exist |
| 7 | Room templates | Med | Needs the 980-quotation analysis first |

Items 1–3 are roughly a day between them and each closes a stated promise. Item 5 is the one with a
deadline attached, because it gets much more expensive once Hauspire and Urbanline have entered
their rate cards in the current shape.
