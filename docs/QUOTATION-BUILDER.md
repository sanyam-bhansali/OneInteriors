# Quotation builder — plan

**Status:** planned, Sprint 5–6.

**Revised after reviewing the Hauspire quotation app** (`Quotation automation/Quotation hosted`).
That app is a working, calibrated, single-tenant version of most of this, on the
same stack. Large parts port directly; the parts that don't are the parts that
matter most, and they're listed here honestly.

---

## Why this is the highest-value thing we build for studios

A ₹8–10 lakh quote is 60–120 line items, revised four or five times during
negotiation, usually in Excel. Version confusion at signing is routine and
"that's not what you quoted" is one of the most common disputes in the category.

It also generates what the rest of the product needs: line items feed the
indicative quote, material spec becomes what we verify at each milestone,
category totals become the milestone schedule, and real rate data makes
budget-fit scoring reflect delivered prices instead of claimed ranges.

---

## What we inherit from the Hauspire app

| Asset | Value |
|---|---|
| **ProductMaster** — 52 products with rates, work codes, descriptions, room tags, first-quote defaults | Months of work. Real catalogue structure, real copy for every line's "details" text. |
| **Four price types** — Area, Unit, SqFt, RFT | The actual dimensional model Indian interior quoting uses. My original spec underspecified this badly. |
| **Auto-build engine** (`buildQuote.ts`, `template.json`) | BHK → rooms → auto-generated first quote. This *is* the indicative quote, already calibrated. |
| **Domain constants** | Kitchen run = `(W + D) − 900mm`. Standard heights: base 750, wall/loft 600, wardrobe 2100, TV 2100, console 900, mandir 1800. `92903.04 mm²/sqft`. |
| **Payment staging** | Booking advance + 5/10/40/40/5. Informs — but does not become — our milestone plan (see below). |
| **Plan OCR + 3D render** (`ocrPlan.ts`, `/api/extract-plan`) | Upload a floor plan, extract rooms and dimensions. Could pre-fill the brief. Later. |
| **`PROJECT_LEARNINGS.md`** | Genuinely good hard-won rules — AI parsing, graceful degradation, Supabase RLS. Read it before building. |
| **Rate provenance** | Archive medians across 25,581 line items from 940 quotations, with the fee/discount formula reverse-engineered and verified to the rupee against 4 real quotes. |

**Same stack** — Next.js App Router, TypeScript, Tailwind, Vercel. Supabase is
Postgres, so it coexists with Prisma; we can host on Supabase and keep Prisma as
the client.

---

## Where my original spec was wrong

Recorded so the corrections stick.

**1. I invented a 14-category taxonomy. The real structure is product-level.**
Hauspire prices *products* (Base Cabinets, Tall Pantry Unit, Mandir), each
tagged to rooms. My `civil / flooring / false_ceiling / …` list was a plausible
guess and it is not how anyone actually quotes. **Use the product model.**

**2. I missed the Area price type.** I had "sqft / rft / unit / lumpsum". The
one that carries most of the value is **Area**: width × height in *millimetres*,
converted to square feet, times a ₹/sqft rate. That's how cabinetry and
wardrobes are priced, and it's what makes a dimension edit auto-reprice.

**3. MO / NM is a commercial axis, not a scope axis.** Modular (MO-01) vs
non-modular (NM-01) exists so the modular discount can apply to one and not the
other. It is *not* a comparison taxonomy. **We need both:** MO/NM per line for
pricing, and a coarse scope category for cross-studio comparison. That
synthesis is the one genuinely new thing we add.

---

## What must change before it can serve the platform

### 1. Single-tenant → multi-tenant. Non-negotiable.

`product_master` is one global table. On our platform **every studio has their
own rate card**. Every product, rate and template row needs a `studioId`.

The commercial constants are Hauspire's too — `FEE_RATE = 0.07`,
`MODULAR_DISCOUNT = 0.15`, `BOOKING_ADVANCE = 25000` are hardcoded module
constants. Those are one studio's commercial model. They become per-studio
configuration.

### 2. The governance landmine — read this twice

**Hauspire's rates must never become the platform's default rates.**

If every studio quotes off a catalogue seeded with the cofounder's factory
pricing, we have effectively set market prices in favour of a business we own —
and it will be read exactly that way the moment one studio notices. That is the
conflict `FUTURE-SCOPE.md` §3 exists to prevent, and it would do far more damage
here than in supply, because pricing is where a studio's margin lives.

**What is legitimate**, and genuinely valuable:

- **Structure, shared.** The product list, the room tags, the price types, the
  description copy — this is a *format*, not a price. Ship it as an empty
  catalogue every studio fills with their own numbers.
- **Benchmark, anonymised.** "Your base-cabinet rate is 18% above the Pune
  median across 12 studios." Aggregate, never attributed, never prescriptive.
  Only once enough studios are loaded that no single one is identifiable.

**What is not:** any studio's rate card pre-populated with Hauspire's numbers,
and any nudge toward Hauspire pricing anywhere in the flow.

Say this in the studio agreement: *rate cards are private, we never set your
prices, and aggregate benchmarks are anonymised.*

### 3. Quotes must be immutable and versioned

The `quotes` table stores `lines jsonb` and edits in place. For an in-house tool
that's fine. For us it is not: **"that's not what you quoted" has to be
answerable with a diff, not a memory.** Every revision becomes a new immutable
row; the customer sees every version sent to them.

### 4. Money moves to integer paise

Hauspire's app works in rupees with `Math.round`. Ours is integer paise through
`src/lib/money.ts` — `applyBps` for rates, `splitAcross` for milestones. Convert
at the import boundary and never again. (Their `inr()` uses
`toLocaleString('en-IN')`, which does give correct lakh/crore grouping — our
`formatINR` is equivalent.)

### 5. Payment stages ≠ our milestone plan

Theirs is **factory-weighted**: booking → design draft 5% → design closure 10%
→ procurement 40% → dispatch 40% → handover 5%. That is right for a
manufacturer, where the cost lands at production.

Ours is **site-progress-weighted**: design sign-off 15 → civil 20 → modular
install 30 → services 20 → finishing 15. That is right for a platform verifying
work on site, because we release against *photographs of completed work*, not
against a factory event we cannot see.

Keep ours. Theirs is useful evidence that Indian clients accept staged payment —
which is the assumption the whole model rests on.

### 6. Auth swaps

`designer_id` is a Clerk user id. Ours is a WhatsApp-verified phone.

---

## ⚠️ A finding you should act on independently of this

**`CALCULATIONS.md` is stale, and 21 of 52 products disagree with the live
`productMaster.json`.** Not rounding — structural:

| Product | Doc | Live |
|---|---|---|
| Base Cabinets | ₹2,035/sqft | ₹2,580/sqft |
| Platform Creation | ₹18,500 | ₹50,000 |
| Appliance Unit | ₹22,000 | ₹16,000 |
| Crockery Unit | ₹36,500 **Unit** | ₹2,580/sqft **Area** — *the price type changed* |
| Workstation | ₹12,000 | ₹2,000 |

Anyone pricing from that document is wrong on roughly 40% of the catalogue. The
document says rates are "archive medians ~15–20% below current standard", which
suggests the JSON was deliberately updated to current rates and the doc was
never caught up. Worth fixing in the Hauspire repo regardless of this project —
and it's the argument for generating rate documentation from the data rather
than maintaining it by hand.

---

## Data model

Extend `prisma/schema.prisma`:

```
Product           studioId, name, workCode (MO|NM), priceType (AREA|UNIT|SQFT|RFT),
                  ratePaise, unitPaise, details, rooms[], scopeCategory,
                  fqDefaults (jsonb: w, h, qty, area, len, perBath, perBed,
                  useRun, balcony, bhk), sortOrder
                  → per-studio catalogue. Ports directly from ProductMaster
                    plus studioId and scopeCategory.

RateCardVersion   studioId, effectiveFrom, note
                  → rates change. A quote must price against the version
                    current when it was issued, never today's.

Quotation         briefId, studioId, kind (INDICATIVE|FIRM), version,
                  supersedesId, status, totals, assumptions, variancePct
                  → immutable. A revision is a new row.

QuotationLine     quotationId, productId?, room, description, workCode,
                  priceType, widthMm, heightMm, qty, sqft, rft, ratePaise,
                  amountPaise, materialSpec (jsonb)

StudioPricing     studioId, feeBps, modularDiscountBps, bookingAdvancePaise
                  → Hauspire's 7% / 15% / ₹25,000, per studio
```

`scopeCategory` is the new field and the one that earns its place: a coarse
bucket (`modular_kitchen`, `wardrobes`, `carpentry`, `false_ceiling`,
`painting`, `electrical`, `plumbing`, `flooring`, `furnishing`, `appliances`,
`civil`, `design_fee`) mapped onto each product. Studios keep their own product
names; the category is what makes two quotes comparable in the compare tray, and
what generates the milestone schedule. **Without it, "₹8.4L vs ₹9.1L" tells the
customer nothing.**

---

## Build sequence

| | Scope | Est | Notes |
|---|---|---|---|
| **A** | Port ProductMaster shape → `Product` with `studioId` + `scopeCategory`; CSV import | 2d | Structure ported, **rates empty** |
| **B** | Rate card CRUD + versioning | 2d | |
| **C** | Port the four price types and `lineAmount` into `money.ts` (paise) | 2d | Direct port + unit conversion, with tests |
| **D** | Quote builder: lines, live totals, per-studio fee/discount, GST, immutable versions | 4d | |
| **E** | Material spec per line | 2d | Feeds milestone verification |
| **F** | Customer quote view, grouped by scope category, version history | 2d | |
| **G** | Port the auto-build engine → indicative quote from brief × rate card | 3d | Biggest single inherited win |
| **H** | Scope-normalised comparison across 3 quotes | 3d | |
| **I** | Accepted quote → milestone plan via `splitAcross` | 1d | |

**~21 days.** Materially cheaper than building from nothing because C and G —
the hard, calibrated parts — are ports rather than inventions.

**Later:** plan OCR pre-filling the brief; anonymised rate benchmarking once
enough studios are loaded.

---

## Still needed from you

1. **Two pilot-studio rate cards** — to confirm the product model holds outside
   Hauspire. It's one company's catalogue until a second one fits it.
2. **GST treatment**, from your CA. 18% is the headline, but composite supply vs
   works contract changes it, and it is wrong on a signed document otherwise.
   Note the Hauspire app has **no GST handling at all** — TPV is pre-tax. Ours
   cannot be.
3. **Confirmation on the rates question** — that studios load their own, and
   Hauspire's catalogue is used for structure only.

---

## Open questions

- **Are rate cards visible to us?** They're commercially sensitive. Proposed:
  private by default, aggregate-only for budget-fit scoring, stated plainly in
  the studio agreement.
- **Who owns a quotation if a studio leaves?** Should be the studio. Write it
  down before it's contested.
- **How much history does the customer see?** Every version sent *to them* —
  not internal drafts.
