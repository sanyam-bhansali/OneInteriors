# The Hauspire quotation software in the customer flow

**29 September 2026.** How the Hauspire *Quotation Studio*
(`C:\Users\sanya\Downloads\Quotation automation\Quotation hosted`, repo
`sanyam-bhansali/hauspire-quotation-app`) maps onto One Interiors, and how it
plugs into the customer journey. This is the detail behind Phase 2 of
`docs/CUSTOMER-JOURNEY-PLAN.md` (§7).

Every claim below about the Hauspire app was read from its source.

---

## 1. What the Hauspire app is

A designer's tool. A single studio and a single operator, with everything
editable. It is Next.js 14, about 5,200 lines, with no tests.

- **Floor plan → quote.** Upload a PDF or photo. Claude reads it (Gemini is the fallback, then in-browser OCR, then manual entry). The reading becomes a first quotation, room by room, from a 59-product master.
- **Builder.** Editable lines, a product picker, drag to reorder, and sales/design stages with an original-vs-final comparison.
- **Outputs.** A branded print PDF, a room summary with a donut chart, the payment schedule, terms, a three.js isometric view of the flat, and an AI-beautified render.
- **Also** an electrical bill module and a product-master admin screen.

---

## 2. Side by side with what One Interiors already has

| Capability | Hauspire app | One Interiors today | For the customer flow |
|---|---|---|---|
| **Read a floor plan** | Claude vision with a good prompt; brace-balanced JSON parse; Gemini fallback; OCR fallback | **Nothing reads plans.** `/prepare` uploads and stores them only | **Take theirs** (§4.1), with the fixes in §3 |
| **Rooms** | Kitchen, Master, Kids, Guest, Parents bedroom, Living/Dining/Foyer, Study, Other Services; balcony-dependent items | Kitchen, three bedrooms, Living & dining, Bathrooms, Whole home | Merge: add the 4th bedroom, study and dry balcony |
| **Catalogue** | 59 products keyed by **display name**; `template.json` is dead code | ~25 items keyed by **stable code** (`kitchen_base`…) | Keep our codes; add their items and sizing rules |
| **Sizing** | Area (W×H ÷ 92,903.04), unit, sq ft, per bathroom; wardrobes "sized to plan" at 55% of the shorter wall; false ceiling per room from plan area | Area, unit, per sq ft of carpet, per bathroom; standard sizes plus the kitchen run | Take their plan-driven sizing |
| **Scope** (kitchen only, one room, renovation) | **None** | **None** in the first quote | Build it (§4.2) — neither side has it |
| **Pricing formula** | 7% fee on everything; 15% off modular (editable); optional on-spot discount; **no GST** | 7% fee; 10% off modular (median of 934 quotes); **18% GST**; integer paise | Keep ours; decide the discount and GST (§6) |
| **Payment schedule** | ₹25,000 booking, then 5 / 10 / 40 / 40 / 5% | Not shown to customers | Show it, per studio (§4.4) |
| **Rates per studio** | **Not multi-tenant** — one studio, one product master | `StudioFiledRate` per studio: PENDING → ops approval → LIVE | Ours |
| **Past quotations → rates** | No importer (calibrated offline once) | **Built:** upload → Claude reads → median rate per item → ops approves → fills the studio's product master | Ours — your 50–60-quotes plan (§5) |
| **3D view of the flat** | three.js isometric from the plan reading | None | Later (immersive idea 6) |
| **Revisions** | Sales/design stages, original vs final | First-issue snapshot and diff (studio side) | Studio side only |

**The short version:** the Hauspire app contributes the **front half** (read
the plan, turn rooms into lines). One Interiors already has the **back half**
(many studios, each with its own rates read from its own quotations, priced
safely in paise). The customer flow needs both joined, plus scope, which
neither has.

---

## 3. What must be fixed on the way in

Carrying these over unchanged would put them in front of every customer.

1. **No carpet area.** The prompt never asks for it, and painting and electrical are priced on fixed per-BHK areas (550 / 850 / 1,150 / 1,650 sq ft). → Ask for the carpet area if printed; otherwise sum the room areas and label the result as computed.
2. **A study is counted twice.** The prompt tells the model to count a study as a bedroom ("3 bedrooms + a study is 4 BHK"), and `hasStudy` then adds an "Office / Study" room as well. A 3 BHK + study is priced with a fourth bedroom *and* a study. → Report bedrooms and study separately, and never fold one into the other.
3. **Plan sizes never reach two rooms.** The model names rooms "Living/Dining" and "Study"; the builder's rooms are "Living, Dining & Foyer" and "Office / Study", so those dimensions are dropped. Repeated rooms ("Toilet" ×2) overwrite each other. → Map to our room codes explicitly and keep repeats.
4. **The vision path validates nothing.** Only the OCR fallback checks that sides are 600–12,000 mm and that a kitchen is 2,000–4,600 mm. A misread from the model goes straight into the quote. → Apply those checks to every reading, and anything outside them goes to the confirm step as "please check".
5. **Confidence gates nothing.** → Low confidence, or any failed check, means the customer must confirm the values before anything is priced. AI proposes, the customer confirms (LEARNINGS-FROM-QUOTATION-APP §1.1).
6. **No timeout, and a retired fallback model** (`claude-3-5-sonnet-20241022`). → Use our `anthropicModel()`, a timeout, and redacted errors, as `extract-agent.ts` already does.
7. **Large files fail.** The whole file is base64'd into one request with no size limit, and Vercel refuses bodies over ~4.5 MB. → Upload to the private `floor-plans` bucket first (the upload already exists) and read from there, downscaling images.
8. **Items are identified by name.** Renaming "Painting - 3BHK" breaks the King-bed swap, the false-ceiling matching and the ordering. → Stable codes, as ours already are.

---

## 4. How it plugs into the customer flow

```
OneBrief ─ screen 3 "Have your floor plan?"
   │  upload → private bucket → readFloorPlan() → normalisePlan()
   │  → "We read: 3 BHK + study, 1,180 sq ft, kitchen 4.2 m, 2 bathrooms — right?"
   │  customer confirms or corrects  ─────────────────────────┐
   │                                                           ▼
   ├─ screen 5 scope + checklist ──► linesFor(reading, scope, items)   canonical lines, our codes, real sizes
   │                                                           │
   └─ screen 6 finish level (bands)                            │
                                                               ▼
OneMatch ─ for every matched studio:  price(lines, studio's LIVE filed rates)
          → first quote, instantly, same lines for every studio
OneCompare ─ same lines side by side; per-material prices; AI summary
```

### 4.1 `modules/floorplan/` — the reader

- `readFloorPlan(path)` — **server-only**. Their prompt, improved per §3; their `extractJson` scanner (brace-balanced, safe with prose and thinking blocks); our Claude client, with a timeout.
- `normalisePlan(raw)` — **pure and tested**: feet → mm, room-name mapping to our codes, the 600–12,000 mm and kitchen 2,000–4,600 mm checks, kitchen run = width + depth − 900 (as they compute it), carpet area, and a list of what needs confirming.
- Output: `{ bhk, hasStudy, bathrooms, hasBalcony, carpetAreaSqft, kitchenRunMm, rooms[{ code, widthMm, depthMm }], confidence, needsConfirming[] }`.
- Stored on the brief (`floorPlanReading`, jsonb) **after the customer confirms**, never before.
- **No OCR fallback in the customer flow.** It downloads its engine from a CDN into the browser, and a manual confirm is the better fallback here. Gemini as a second provider is optional (§6).

### 4.2 The catalogue and scope — `linesFor(reading, scope, items)`

One canonical catalogue, **our stable codes**, extended from theirs:

- **New rooms:** fourth / parents bedroom, study, dry balcony.
- **New items:** glass-profile shutters, dry-balcony base and overhead, master workstation. Dressing and mirror become separate lines, and so do bed and headboard, as studios quote them.
- **Their sizing rules:** wardrobes and lofts sized to the plan (55% of the shorter wall, 1,200–2,400 mm), false ceiling per room from plan area, balcony-only items, lines repeated per bathroom.
- **Scope membership per item**, which neither app has:

| Scope | Lines |
|---|---|
| Full home | every room, minus unticked items |
| Kitchen & wardrobes | kitchen lines + every bedroom's wardrobe and loft |
| Single room | the chosen room(s) only |
| Renovation | a civil block (flooring, bathroom, kitchen civil, rewiring, painting, false ceiling) + any rooms ticked |

- **The civil block needs rates studios actually quote.** Their app has "Civil and Plumbing Changes" as a single ₹1,00,000 unit line, which is too coarse to compare. The civil lines are defined with the first studios' archives, not guessed.
- Work codes (factory MO vs site NM) are reconciled item by item. The two apps disagree on the TV unit, mandir, tandems and the bed.

### 4.3 Pricing — ours, unchanged in method

- Integer paise, basis points, the 7% fee, the modular discount, GST, and the ± band by what we measured. Their `pricing.ts` is floating-point rupees with stages rounded one by one, so it is not carried over.
- Each studio's LIVE filed rate per code. An item a studio has no rate for is **named, not guessed**. There are no placeholder rates under a real studio's name (plan §7.3).

### 4.4 What the customer sees that comes from their app

- The **room-by-room** document, in the order real quotes use (their `ITEM_ORDER`).
- The **specification line** under each item ("BWP plywood carcass, HDHMR shutters…"), from the studio's own filed spec where they have one.
- The **payment schedule**: when money moves. Theirs is Hauspire's own (₹25,000, then 5 / 10 / 40 / 40 / 5%), so each studio's schedule should be its own (a studio-profile field), shown the same way for every studio.
- **Later:** the isometric 3D of *their* flat from the reading (immersive idea 6).

---

## 5. The data feed — 50 to 60 quotations per studio

The pipeline already exists, end to end:

```
studio uploads quotations (onboarding rates step)
  → quotation-archives bucket (private)
  → extract-agent.ts: Claude reads each PDF / photo into lines
  → ingest.ts: median rate per catalogue code, with spec text
  → StudioFiledRate PENDING → ops reviews on /ops/[slug] → LIVE
  → fillProductMaster: the studio's own product master (studio side)
  → customer first quotes priced on the LIVE rates (this document)
  → the studio's band = price a standard home on those rates → ₹/sq ft
```

What has to change for your plan:

- **The threshold.** `MIN_QUOTATIONS_FOR_RATES = 100` (`quotation/catalogue.ts`). Ingest refuses below 100, and `from-archive.ts` says "around twenty". Your plan is **50–60**. Proposed: 50 quotations per studio to price at all, *and* a per-item minimum (e.g. a rate becomes LIVE only when the item appears in at least 8 of them), so a studio with 55 quotes but only 3 containing a mandir shows the mandir as "not priced" rather than a median of three.
- **Workbooks.** Quotations in Excel are stored and skipped; only PDFs and images are read. Many studios keep quotes in Excel, so reading `.xlsx` properly (it is structured data and needs no AI) is worth adding.
- **Aliases.** `ingest.ts` folds some lines together (dressing and workstation into one bedroom line) that the Hauspire master keeps separate. The merged catalogue (§4.2) and the aliases need to change together.
- **The band.** Computed per studio from its LIVE rates on a standard 2 BHK and 3 BHK (`studioTierFrom`), then confirmed by ops (plan §4.2).
- **Per-studio specification text** is already captured with each rate; it becomes the spec line under each quote item.

---

## 6. Decisions

1. **GST on the customer quote.** Our first quote adds 18%; the Hauspire app shows none. Recommended: show it as its own line, as today — the customer pays it, and a total without it reads cheaper than the studio's real quote.
2. **Modular discount.** 10% (the median of 934 real quotes) as a fixed rule, or each studio's own figure from its archive? Recommended: each studio's own, read from its quotations, falling back to 10%. It is part of the studio's pricing, not ours.
3. **Payment schedule.** Recommended: each studio's own, collected in the studio profile, shown identically for every studio.
4. **The 50-quotation threshold and the per-item minimum.** As proposed in §5?
5. **Port or reuse.** Recommended: **port the reader and the rules into this codebase**, and do not call the Hauspire app as a service. It has no tenancy, open database policies and Hauspire branding throughout, and One Interiors needs one catalogue and one set of codes.
6. **Gemini as a second provider** for the reader. It adds a key and a vendor; the manual confirm is already the fallback. Recommended: not now.

---

## 7. Not now: studios who are mostly carpenters

Parked on 29 September. Studios whose work is mainly **site carpentry**
rather than factory modular go through many iterations, and their prices
fluctuate. One fixed rate per item fits them badly.

To keep the door open, the design should not assume that a rate is always a
single number. Per-line ranges for site-made (NM) work, a wider band on those
lines, and a labour/material split are the likely shapes. Nothing is built for
this yet; it is to be decided with the owner.

---

## 8. Found in the Hauspire app itself — not One Interiors, but worth fixing there

- **Its database is readable and writable by anyone.** Every table's policy in `supabase/schema.sql` is `using (true) with check (true)` for the anon role, and the anon key ships in the browser bundle (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). The `quotes` table holds client names and mobile numbers, so anyone who opens the deployed app can read every client's quote and contact details, and alter them.
- **The admin password is in the browser bundle.** `AdminGate` checks it on the client, with a hard-coded fallback, through a `NEXT_PUBLIC_` variable.
- **The Gemini API key travels in a URL query string**, where it can end up in logs.
- **Two designers saving at once can get the same quote number** (max + 1, computed in the browser).
