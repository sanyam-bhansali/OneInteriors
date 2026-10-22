# Quotations: the Hauspire app against ours, and the full import

**Owner, 22 Oct 2026:** import every quotation from Hauspire's old quotation app ("hauspire-quotation-app",
Next 14 + Supabase, `Downloads/Quotation automation/Quotation hosted`), make our builder work exactly like
it ("same functionality, everything exactly similar"), and make "Export as PDF" produce its PDF.

Audited against the old app's code at commit `2de9340` (its `README.md`, `CALCULATIONS.md`,
`FIRST_QUOTE_LOCKED.md`, `src/lib/{pricing,buildQuote,firstQuoteDefaults,compare,quotesRepo,printDoc}.ts`,
`src/components/{QuoteTable,Totals,DiscountPicker,FinalCompare,PrintDocument,PrintFinal,QuoteSummary,RoomDonut,TermsView,ProductCombo}.tsx`,
`src/app/{builder,first-quote,quotations}/page.tsx`, `src/app/globals.css`, `tailwind.config.ts`,
`supabase/schema.sql`). The 12 Oct audit ([QUOTATION-PARITY.md](QUOTATION-PARITY.md)) covered the first
quote and product master; this one is about calculations, the builder, the PDF and the import.

**Status:** *same* = behaves and looks as the old app; *changed 22 Oct* = differed and was made the same in
this pass; *differs (kept)* = deliberately different, with the reason; *ours* = an extra the old app does
not have, kept out of the old flows.

## 1. Calculations (`lib/pricing.ts`, CALCULATIONS.md)

| # | What | Old app | Ours before | Status |
|---|---|---|---|---|
| 1 | W × H line | `Math.round((W×H)/92903.04 × rate)` rupees | thousandths of a sq ft, then paise (₹60,184.25) | **changed 22 Oct** — `pricing.ts lineAmount`, the old float order, whole rupees |
| 2 | Sq ft / running ft / unit line | `Math.round(q × rate)` | paise | **changed 22 Oct** — same function |
| 3 | Professional fee 7% | `Math.round((MO+NM) × 0.07)` | `applyBps` in paise | **changed 22 Oct** — `pctOfRupees` |
| 4 | Modular discount | `Math.round(MO × pct)` | paise | **changed 22 Oct** |
| 5 | On-spot / named discount | flat ₹ off TPV | same | same |
| 6 | GST 18% after discounts | `Math.round(TPV × 0.18)` (also on a negative TPV) | paise, only when TPV > 0 | **changed 22 Oct** |
| 7 | Payment stages | ₹25,000, then 5/10/40/40/5% of the rest, each `Math.round` on its own | `splitAcross` in paise, our own labels | **changed 22 Oct** — rupee rounding, old labels and End Deliverables; *differs (kept)*: the last stage takes the remainder so the stages add up to the contract (the old app can be ₹1–2 off its own total; see the GST example in the tests). Also in `payment-template.ts scheduleAmounts` via `money.ts splitRupees` |
| 8 | Discounted column | `Math.round(amount × (1 − pct))`, MO-01 only | paise | **changed 22 Oct** — `rooms.ts discountedPaise` |
| 9 | Kitchen run, feet-inches, BHK rooms | `estimateKitchenRun`, `feetInchesToMm`, `BHK_ROOMS` | `floorplan/reading.ts`, `configure.ts` | same (12 Oct audit) |
| 10 | Booking advance larger than the quote | negative stages | capped at the total | differs (kept): only under ₹25,000 |

The old code is kept, unchanged but for types, in `src/modules/studio-quote/hauspire-calc.ts` (the yardstick).
`tests/quote-parity-calc.test.ts` pins golden values from CALCULATIONS.md's own products (base cabinets
3960×750 @ ₹2,580 = ₹82,480; vanity 600×600 = ₹9,998; …), a fake 3 BHK end to end (MO ₹6,93,123, NM ₹2,99,588,
fee ₹69,490, discount ₹1,03,968, TPV ₹9,58,233, GST ₹1,72,482, stages ₹46,662 / 93,323 / 3,73,293 / 3,73,293 / 46,662),
and 500 generated fake quotations where every line, MO, NM, fee, sub-total, discount, TPV, GST and grand total
must equal the old code's × 100, to the paisa.

## 2. The builder (`/builder`, `QuoteTable`, `Totals`, `DiscountPicker`, `FinalCompare`)

| # | What | Status |
|---|---|---|
| 11 | Left panel: Project (client, mobile, location, quotation date + Today, BHK incl. Villa) | same |
| 12 | Rooms: include study, apply configuration (keeps lines), rename (merges), add custom room, room order ↑↓ | same |
| 13 | Add a line: room, searchable product, rate line, W/H or sq ft or rft or qty from the master, live amount, + Add line | same; **changed 22 Oct**: the live amount used paise arithmetic, now `lineAmount` |
| 14 | Propose a new product | same (ours: owner/PM add straight to the master) |
| 15 | Discount picker names | "On-spot discount, Festive offer…" | **changed 22 Oct** to the old names: On-Spot / Festive / Referral / Loyalty / Negotiated Discount; unnamed discounts print "On-Spot Discount" |
| 16 | Fees & Tax ticks, GST note | same |
| 17 | Save Sales Final / Save Design Final, quote no · editing … | same (ours: Design Final is a linked copy, revisions R1, R2…) |
| 18 | Tabs Quotation / Final (Original vs Revised) / PDF preview; Save & Quotation PDF, Save & Final PDF | same |
| 19 | Table: drag + ▲▼ within a room, product combo per row, code, details, Units/SqFt/RFT, W, H, amount, discounted, ✕, sub-total + "+ add item" | same (ours: duplicate, line note, "agreed" chip) |
| 20 | Changing a size re-prices a line with a rate, over a typed amount | ours kept the typed amount | **changed 22 Oct** — `line-edit.ts withRepricing` |
| 21 | Swapping a product: master size, else the line's, else 1000 mm; qty from master else 1 | ours kept the size within a unit | **changed 22 Oct** |
| 22 | "+ add item": New item, MO-01, ₹0, no quantity | ours: qty 1 | **changed 22 Oct** |
| 23 | Totals table with % box and ticks; stages under it | same; stage labels now the old ones |
| 24 | Final tab: Original = the quotation as opened; "Snapshot current as Original"; Product / Size (Orig → Final) / Original / Final / Change; Original/Final TPV and change | ours compared the sent copy by product sums, no size column | **changed 22 Oct** — `compare-lines.ts` (port of `lib/compare.ts`) and `HPanels FinalCompare`; the printable page still compares revisions |
| 25 | Quote numbers: running series from 2300 | ours: YYYY-NNN | **changed 22 Oct** — a studio already on a plain series ≥ 2300 (Hauspire after the import) continues it (`nextQuoteNumber`) |
| 26 | My Quotations: search, client folders with latest amount, Open & edit, Use as template | search, open, template: same; client folders: differs (kept) — leads hold a client's quotations |
| 27 | First quote (auto-build) | same (12 Oct audit, `configure.ts`); now priced with the old rounding through `lineAmount` |
| 28 | 2D plan, 3D view, OCR, electrical bill | see QUOTATION-PARITY.md (partly / missing / owner to decide) |

## 3. The PDF (`PrintDocument`, `QuoteSummary`, `RoomDonut`, `TermsView`, `PrintFinal`, print CSS)

The old app prints with the browser (`window.print`, `@page { size: A4; margin: 10mm }`), as ours does.

| # | What | Status |
|---|---|---|
| 29 | Cover and About pages (fixed images) | ours: the studio's own brand pages (Settings), else a drawn cover. For Hauspire, upload `public/brand/cover.png` and `about.png` from the old app as its two brand pages |
| 30 | Page size and margin | **changed 22 Oct** — named page `quotation`, A4, 10 mm (was the global 14 × 12 mm) |
| 31 | Typography: Tailwind's system sans at 12 px, tables 11 px, details 10 px | **changed 22 Oct** — `quote-doc.css` copies each class (commented with the class it stands for) |
| 32 | Header grid: Client Name · Quotation No / Client Mobile · Date / Flat No · Location / Configuration | **changed 22 Oct** to one grid in that order |
| 33 | Room band above the table, column header repeats on a new page | ours repeated the band in the header | **changed 22 Oct** |
| 34 | Columns S.No., Product, Work Code, Details, Units, Width(mm), Height(mm), Amount (₹), Discounted (₹); auto widths | **changed 22 Oct** (fixed widths removed) |
| 35 | Units only on a per-unit line | ours also on sq ft / rft | **changed 22 Oct** — `docUnitsText` |
| 36 | Every figure `Math.round(n).toLocaleString("en-IN")`, 0 prints "0" | ours "—" for 0, truncated paise | **changed 22 Oct** |
| 37 | Every MO-01 amount struck through, discounted in green | ours only with a discount | **changed 22 Oct** |
| 38 | Colours: brand #531220, light #7A2A3A, band #F3E9EC, line #E0CDD3; donut's nine colours | ours mixed from the accent | **changed 22 Oct** — exact when the accent is #531220 or #7A2A3A (`HAUSPIRE_COLOURS`); other studios keep their own |
| 39 | Summary By Room table + donut (140 px), legend only rooms with value | **changed 22 Oct** |
| 40 | Totals: MO, NM, fee, Sub-Total, Discount on Modular (always), "<name> (₹)", TPV / GST / Grand Total | **changed 22 Oct** (the discount row was hidden at 0; the name had no "(₹)") |
| 41 | Payment Stages: old labels, **bold** deliverables, the note | **changed 22 Oct** — Hauspire's own six print in the old words (`hauspireWords`); a studio's reworded stage prints as written |
| 42 | Material Specification with a Brand column | **changed 22 Oct** — always the three columns |
| 43 | Terms: "HAUSPIRE" + TERMS & CONDITIONS header; ":" headings, "-" bullets, other lines indented grey | **changed 22 Oct** (other lines were plain paragraphs) |
| 44 | Filename "<Client> Hauspire Quotation <No> <dd-mm-yyyy>" | same (`quoteFileName`, with the studio's name) |
| 45 | Final PDF: cover, about, header, Original vs Revised by room, totals, then QuoteSummary of the final, then terms | ours had no closing summary or terms | **changed 22 Oct** — `DocSummary` + `TermsSheet` on `/compare`; the line table itself differs (kept): the owner's team asked for work code, details, notes and change sentences (15 Oct) |
| 46 | Ours on top | welcome note (when set), line notes, the footer (validity, GSTIN, our mark by tier), change orders and floor plan on the print page — ours, printed only when present |

`scripts/render-quote-pdf.ts` renders a quotation with the same component and stylesheet to an A4 PDF
through Playwright's Chromium, for side-by-side comparison with the old app's print of the same quotation:

    npx tsx scripts/render-quote-pdf.ts --sample --out sample.pdf
    npx tsx scripts/render-quote-pdf.ts --from-row row.json --brand cover.png,about.png --out 2301.pdf
    npx tsx scripts/render-quote-pdf.ts --quote <id> --studio <slug> --out 2301.pdf   # DATABASE_URL, read only

`--from-row` takes one old `quotes` row (JSON) and prints it with Hauspire's colours, stages, material
specification and terms (`scripts/fixtures/hauspire-terms.txt`, the old app's default; `--terms` for yours).

## 4. The full import (`scripts/import-hauspire-quotes.ts`)

    npx tsx scripts/import-hauspire-quotes.ts --studio <slug> --dry-run
    npx tsx scripts/import-hauspire-quotes.ts --studio <slug> [--pool-team <member email or phone>]
    npx tsx scripts/import-hauspire-quotes.ts --studio <slug> --from-file rows.json --dry-run

- **Reads** the old app through the existing read-only connection (`HAUSPIRE_QUOTES_SUPABASE_URL`, `_KEY`,
  `_STUDIO_SLUG`, which must equal `--studio`), `GET /rest/v1/quotes?select=*&order=created_at.asc,id.asc&limit=500&offset=…`
  page by page (`hauspire-fetch.ts`). Never writes there. `--from-file` reads an export instead.
- **One quotation per (quote_no, stage)**: the newest row is the quotation; older rows of the same group
  (older app versions saved a row per save) become its earlier revisions; every row's content becomes a
  frozen revision R1…Rn, the last being what the client has. Status ISSUED.
- **Mapping** (`hauspire-map.ts mapQuote`): every line with room, product, MO-01/NM-01, details, W/H, sq ft,
  rft, qty, rate and the amount kept as agreed; `modularPct`, `onSpot` + `onSpotLabel`, `feeOn`, `gstOn`,
  `quoteDate`; client name, mobile, location, BHK, kitchen run. Sales Final keeps the old number ("2312"),
  its Design Final is "2312-D" and points at it; a taken number gets "-H". The builder shows
  "Imported from the Hauspire quotation app (quotation 2312)"; imported quotations edit like ours.
- **Idempotent** by `importedFrom = "hauspire:<row id>"`: unchanged → left; changed in the old app and not
  edited here (updated ≤ 5 s after import) → updated, the new content added as a revision; changed in both →
  ours kept, reported.
- **Leads**: by mobile (last ten digits); else name (case/spacing/punctuation/titles ignored) + location
  (the lead's locality or city); none or several → a new lead (source OTHER, "From the Hauspire quotation
  app", in `--pool-team`'s team pool or the studio pool), one per client across their quotations.
- **Report** (dry run and real): counts by stage and action, earlier saves, unreadable rows, leads matched /
  created (listed), the totals check (old stored `tpv` against ours recomputed, to the paisa, mismatches
  listed), the sums. A real run writes one AuditLog row `studio.import.hauspireQuotes` (counts only) and
  a QUOTED line on each lead's timeline. Nothing is sent to anybody.

Fake sample of the report:

    Hauspire quotation app → Test Studio (test)   (DRY RUN: nothing is written)

    Quotations
      rows read from the quotation app             7
      quotations (one per number and stage)        5
        Sales Final                                4
        Design Final                               1
      earlier saves kept as revisions              1
      new here                                     5
      …
      unreadable (skipped)                         1
        ✗ 2305 (bad): its lines are not a list

    Leads
      matched by mobile                            1
      matched by name and location                 1
      created (studio pool)                        1
        + New Person · 9876500077 · 2303, 2304

    Totals check (the old app’s stored total before GST against ours, recomputed)
      checked                                      5
      identical to the paisa                       5
      different                                    0

No schema change was needed: `StudioQuote.importedFrom/importedAt`, `StudioQuoteRevision`, and
`StudioClient.importedFrom/externalId` already exist.
