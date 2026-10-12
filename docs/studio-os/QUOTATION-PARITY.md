# Quotation software: Hauspire's app against ours

**Audited:** 12 Oct 2026, Hauspire's own quotation app (`Downloads/Quotation automation/Quotation hosted`:
`first-quote`, `builder`, `quotations`, `products`, `terms`, `electrical`, `lib/buildQuote.ts`,
`lib/firstQuoteDefaults.ts`, `lib/pricing.ts`, `components/*`, `CALCULATIONS.md`, `FIRST_QUOTE_LOCKED.md`)
against the studio builder (`src/modules/studio-quote/**`, `src/app/studio/quotations/**`, the lead page,
`/studio/products`, Settings).

**Status** is after the 12 Oct build. **Built 12 Oct** marks what was added or fixed in this pass
(see [FLOORPLAN-QUOTE-BUILT.md](FLOORPLAN-QUOTE-BUILT.md)). Our model stays per studio: every studio has
its own product master, rates, discount, schedule, terms and branding; the **fee is 7% and GST 18% for
every studio** (on or off per quotation), the **modular discount is per studio**.

## First quote (Hauspire `/first-quote`, `buildQuote.ts`, `firstQuoteDefaults.ts`)

| # | Feature | Hauspire | Ours | Status |
|---|---|---|---|---|
| 1 | Upload a floor plan, Claude reads it, the quote is built | first-quote §1 → `/api/extract-plan` | Lead page "Floor plan and files": attach → read once → DRAFT quotation built (`studio-quote/from-plan.ts`, `floorplan/plan-reads.ts`) | **have** · built 12 Oct |
| 2 | Free in-browser OCR when no vision key | `ocrPlan.ts` (tesseract) | No OCR: without a key the quotation is built from the lead's BHK and the page says "Floor-plan reading isn't switched on yet" | missing (deliberately; see remaining) |
| 3 | Sample demo plans | first-quote "auto-fill a sample plan" | — | not applicable (demo aid) |
| 4 | Client, mobile, location, quotation date | first-quote §2 | Client panel, Terms panel (date) | have |
| 5 | BHK + kitchen run (mm) | §2 | "The flat" panel | have |
| 6 | Kitchen run from the plan: W + D − 900 (L-shape) | `estimateKitchenRun` | `floorplan/reading.ts kitchenRunFrom` (also straight / U / parallel) | have |
| 7 | Master: king bed option | §3 tick, `kingMaster` | "Master bedroom: king bed" tick (`HomeConfig.kingMaster`) | **have** · built 12 Oct (was always-on) |
| 8 | Bathrooms → one vanity per bathroom | `perBath` reps | `rules.perBath`, a room per bathroom | have |
| 9 | Dry balcony present | §4 tick, `balcony` rule | tick + `rules.balcony`; from the plan when it shows a dry balcony / utility | have · plan detection built 12 Oct |
| 10 | Study / office room | §4 tick | tick; from the plan's `hasStudy` | have |
| 11 | Size wardrobes (and lofts) to plan walls, 55% of the **shorter** wall, 1200–2400 | `wardrobeWidth` | `floorplan/sizing.ts wardrobeWidthMm` | **have** · fixed 12 Oct (we used the longer wall) |
| 12 | False ceiling, room-wise, from each room's "False Ceiling (Room)" product, area from the plan; default rate when none | §4 tick, `fcRate` | "False ceiling, room by room" tick + optional ₹/sq ft; `configure.ts ceilingProductFor`; W × H products take the room's sides | **have** · built 12 Oct |
| 13 | BHK variant products (painting / electricals by size) | `bhk` tag | `rules.bhk`, and now the size in the product's own name (`bhkOfProduct`) | **have** · name inference built 12 Oct |
| 14 | Standard selection when nothing is flagged | `withStandardSelection` | `configure.ts withStandardSelection` (same name rules, our room categories), with a note | **have** · built 12 Oct |
| 15 | "Select standard 1st-quote set" button on Products | products page | Only the automatic fallback (#14); no button that writes the ticks | partly |
| 16 | Canonical item order within a room (base → tandems → wall → loft …) | `ITEM_ORDER` | `configure.ts itemRank`, studio order for the rest | **have** · built 12 Oct |
| 17 | Product master drives the build (flags, rooms, sizes, rules) | `fq`, `rooms`, `w/h/qty/area/len`, rules | `StudioProduct.inStandardBuild`, `rooms`, defaults, `rules` | have |
| 18 | Add an item: product search, sizes from the master, live amount | "＋ Add item" | "Add a line" panel | have |
| 19 | Propose a new product (not in master) → admin approves | `proposalStore`, Products "Approve/Reject" | A typed line shows "not in your products"; owner / PM press "Add to products"; a salesperson is told to ask | partly · built 12 Oct (no approval queue) |
| 20 | Unknown products auto-proposed on save | `autoProposeNewProducts` | Same marker as #19, per line | partly |
| 21 | Revise in the full builder | "Revise in Full Builder →" | One builder; the first quotation opens in it | have |
| 22 | 2D plan tab | `Plan2D` (schematic from lines) | `FloorPlanView` of the read plan's rooms, on the builder and the PDF | partly |
| 23 | 3D isometric view; 3D render | `Isometric3D`, `/api/render-3d` | — | missing (large) |
| 24 | PDF preview tab, Save as PDF with a client filename | PDF tab, `printWithFilename` | "What the client sees" tab; print page with `PrintButton` filename | have |

## Full builder (Hauspire `/builder`, `QuoteTable`, `Totals`)

| # | Feature | Hauspire | Ours | Status |
|---|---|---|---|---|
| 25 | Open a saved quotation and edit | My Quotations → Open & edit | `/studio/quotations/[id]` | have |
| 26 | Change the client name → new quotation from this one | name-change branch | "Use as template" (`copyQuote`) | have |
| 27 | Sales Final / Design Final | two saves per project | `stage` SALES / DESIGN, "Make the Design Final" | have |
| 28 | Original vs Revised comparison, printable Final PDF | Final tab, `PrintFinal` | Changes tab, `/compare` (Sales vs Design, any R vs R), printable | have |
| 29 | Snapshot current as "Original" | Final tab button | Revisions R1, R2… frozen on each send | have |
| 30 | Modular discount % on the quote | Totals input | Terms panel; the studio's default from Settings | have |
| 31 | Named flat discount (on-spot, festive…) | `DiscountPicker` | Terms panel "Flat discount" | have |
| 32 | Professional fee 7%, on/off | Fees & Tax tick | "Professional fee, 7%" tick; any other % refused; Settings no longer moves it | **have** · built 12 Oct (was a free %) |
| 33 | GST 18%, on/off, after discounts | tick | tick | have |
| 34 | Quotation date | date input | Terms panel | have |
| 35 | Apply a BHK configuration keeping existing rooms | "Apply configuration" (non-destructive) | Rebuild replaces every line, after a second press | partly |
| 36 | Villa configuration | `Villa` | 1–4 BHK only | missing |
| 37 | Rename a room (merging) | Rename room | Click the room heading | have |
| 38 | Add a custom room | "Add custom room" | Add a line with a new room name | have |
| 39 | Room order up / down | "Room order" list | ↑ ↓ on each room heading | **have** · built 12 Oct |
| 40 | Line: product search / swap, defaults from the master | `ProductCombo` per row | "Swap for…" per line | have |
| 41 | Line: work code, details, qty / sq ft / rft, W / H, re-priced live | `QuoteTable` | `LineRow` | have |
| 42 | Line: amount typed over the arithmetic | amount input | "agreed" figure, calculated one struck through | have |
| 43 | Line: per-line "Discounted" column | yes | No: the modular discount is shown once in the totals (same total) | partly (by design) |
| 44 | Line: move up/down, drag within a room | ▲▼, drag | ▲▼, drag | have |
| 45 | Line: remove; "+ add item" per room; room sub-totals | yes | yes (and duplicate a line) | have |
| 46 | Totals: modular, non-modular, fee, sub-total, discount, on-spot, total, GST, grand total | `Totals` | `TotalsPanel` (`pricing.ts computeTotals`, paise, stages sum exactly) | have |
| 47 | Payment stages with "End deliverable" | 6 fixed stages | The studio's schedule (Settings → Payment stages, Hauspire's six by default) | have |
| 48 | One number per project, reused on repeat saves | `quote_no` | `nextQuoteNumber` per studio per year | have |

## The PDF (Hauspire `PrintDocument`, `PrintFinal`, `QuoteSummary`)

| # | Feature | Hauspire | Ours | Status |
|---|---|---|---|---|
| 49 | Cover and About pages | branded images | The studio's profile photos and "About" | have |
| 50 | Header: client, number, mobile, date, location, configuration | header grid | Quotation box + "Prepared for" (mobile line added) | **have** · mobile built 12 Oct |
| 51 | Room tables with S.No. | yes | # column added | **have** · built 12 Oct |
| 52 | Summary by room with a donut | `RoomDonut` | Room summary with bars and % | have (bars, not a donut) |
| 53 | Material specification | fixed list | Per studio (Settings) | have |
| 54 | Terms and conditions, editable | `/terms` | Settings + per quotation | have |
| 55 | Client-friendly PDF filename | `quoteFilename` | `PrintButton filename` | have |

## Lists, products, settings, other modules

| # | Feature | Hauspire | Ours | Status |
|---|---|---|---|---|
| 56 | Search quotations (client, number, mobile, location) | `/quotations` | `/studio/quotations` search | have |
| 57 | Quotations grouped in client folders with the latest amount | folders | Each lead page lists its quotations, revisions and sales final; the list itself is flat | partly |
| 58 | Use a quotation as a template for a new client | "Use as template" | "Use as template" | have |
| 59 | Product master: edit, add, remove, save | `/products` | `/studio/products` | have |
| 60 | Per-product first-quote rules (run, ×bath, balcony, BHK, sizes) | Products columns | Product editor `rules` | have |
| 61 | Reset to defaults / clear the first-quote selection | buttons | Starter catalogue seeds new studios; no reset or clear buttons | partly |
| 62 | Approve / reject proposed products | Products → proposals | — (see #19) | missing |
| 63 | Who may change prices | `AdminGate` | Roles: owner / PM edit products; sales quote only their own leads | have |
| 64 | Reader robustness: model, retries, provider fallback, raw error to the UI | `/api/extract-plan` | Configured model, 45 s timeout, one retry after a timeout, read-once cache, daily cap; reasons shown in words (never the raw reply); no second provider | partly |
| 65 | Electrical bill and electrical rates | `/electrical`, `/electrical-rates` | — | **not built, owner to decide** |

## Count

| Status | Rows |
|---|---|
| have | 50 (12 of them built or fixed on 12 Oct: #1, 7, 9, 11, 12, 13, 14, 16, 32, 39, 50, 51) |
| partly | 9 (#15, 19, 20, 22, 35, 43, 57, 61, 64; #19–20 improved on 12 Oct) |
| missing | 4 (#2 OCR, #23 3D, #36 Villa, #62 approval queue) |
| not applicable | 1 (#3 demo plans) |
| not built, owner to decide | 1 (#65 electrical bill) |

## Remaining (not built in this pass)

- **3D view / render (#23)** — a three.js massing view and the render API: large, needs its own spec.
- **OCR fallback (#2)** — in-browser OCR for when no key is set. Left out on purpose: the owner adds
  `ANTHROPIC_API_KEY`, and the BHK fallback is honest about what it is.
- **Approval queue for new products (#19, #20, #62)** — today the owner or PM adds a typed line to the
  product list in one press; a salesperson's typed line waits for them to do so. A queue needs a table
  and a Products tab section.
- **Non-destructive "apply configuration" (#35)** and **Villa (#36)**.
- **"Select standard set" / reset buttons on Products (#15, #61)** — the automatic fallback covers the
  build; the buttons live on `/studio/products`, outside this pass.
- **Client folders on the quotations list (#57)**, **schematic 2D plan from lines (#22)**,
  **donut instead of bars (#52)**, **per-line discounted column (#43, by design)**.
- **Electrical bill (#65)** — the owner excluded it earlier; owner to decide.
