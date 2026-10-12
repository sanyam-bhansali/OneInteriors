# Floor plan → first quotation, and quotation parity — built

**Built:** 12 Oct 2026, from the owner's requests of the same day. **Migration:**
`prisma/migrations/20261012130000_studio_quote_floorplan` — three new tables, expand only, **not applied**
anywhere. Parity audit: [QUOTATION-PARITY.md](QUOTATION-PARITY.md).

## What a salesperson sees

1. On the lead page, **Floor plan and files**: attach the client's plan (PDF, JPG, PNG or WebP) as
   "Floor plan". When the upload has answered, the page shows *"Reading the plan and building the first
   quotation…"*, reads the plan with Claude and makes a **DRAFT** quotation linked to the lead — name,
   phone, email, society and BHK from the lead; rooms, wardrobe and loft widths, kitchen run, bathrooms,
   study, dry balcony and room-wise false ceilings from the plan. The result is said under the box
   ("Read the plan: 3 bedrooms, 2 bathrooms… First quotation 2026-014 is built from it (40 lines)") with
   **Open the quotation**; each plan file keeps its last result after a reload.
2. They open it, change what they want, and **Mark as sent** (R1). Revisions, sales final, booking and
   permissions are unchanged.
3. On any floor-plan file: **Build a quotation from this plan** (re-runs, or after a failure — always a
   new draft) and **Read rooms** (read only; the next quotation starts from them).
4. On a quotation linked to a lead: **Read rooms from the lead's floor plan** in "The flat" panel —
   attaches the plan to this quotation, fills the kitchen run and bathrooms, shows its rooms; **Rebuild**
   then sizes the lines from it.
5. **No API key:** the lead page says *"Floor-plan reading isn't switched on yet, so the first quotation is
   built from the lead's BHK"*; the builder says *"Floor-plan reading isn't switched on yet."* The upload
   still makes the first quotation from the lead's BHK template (or an empty draft "pick the BHK and press
   Build" when the lead has none).

The automatic build happens only when the lead has **no quotation yet**; a later plan is read and the
page offers the button. A One Interiors client's plan is read but never quoted here (their quotation is
the final quote they sign in the app). A salesperson works only on their own leads (`myLeadScope`,
`mayOnLead`, then `createQuote` checks again).

## Where it is

| Part | File |
|---|---|
| Read once: hash cache, claim, cap, call | `src/modules/floorplan/plan-reads.ts` (`readPlanOnce`, sha256 of the bytes, per studio) |
| The guard rules (pure, tested) | `src/modules/floorplan/plan-cache.ts` — types and sizes (PDF ≤ 15 MB, photo ≤ 5 MB), 200 reads per studio per India day, one retry after a timeout / server error, never again after "could not make out the rooms", a run older than 3 min is dead, messages in words |
| Reading → the flat, messages (pure, tested) | `src/modules/studio-quote/from-plan-rules.ts` |
| Read + build on the server | `src/modules/studio-quote/from-plan.ts` (`buildFromPlan`, `readRoomsForQuote`, `planJobsFor`, `planReaderFor`) |
| Hauspire's first-quote rules, ported into the one standard build | `src/modules/studio-quote/configure.ts` — `withStandardSelection` / `standardSelectionFor` (firstQuoteDefaults), `itemRank` (ITEM_ORDER), `bhkOfProduct` (BHK variant from the name), `kingMaster`, `falseCeiling` + `ceilingProductFor` + optional ₹/sq ft, kitchen ceiling from the plan |
| Wardrobe width = 55% of the **shorter** wall | `src/modules/floorplan/sizing.ts` (was the longer wall; also the customer first quote's sentence in `quotation/first-quote.ts`) |
| Which plan a quotation's rooms come from | `quotes.ts planReadingOf` — the `StudioQuotePlan` link first, then the brief, then the lead's newest read plan |
| Actions | `src/app/studio/quotations/actions.ts` — `buildFromPlanAction`, `planJobsAction`, `readRoomsForQuoteAction`, `addLineToProductsAction` |
| Lead page UI | `src/app/studio/clients/[id]/SalesPanels.tsx` (`FilesBox`, `FileRow`) — "Read rooms" now goes through the cached reader instead of `leads.ts readRoomsOn` |
| Builder UI | `QuoteLines.tsx` (ConfigurePanel: king bed, false ceiling + rate, Read rooms; room ↑↓; "not in your products" + Add to products), `QuoteBuilder.tsx` (room order), `TermsPanel.tsx` (fee 7% on/off), `page.tsx`, `print/page.tsx` (# column, client mobile) |

### Tables (migration `20261012130000_studio_quote_floorplan`)

- `studio_plan_readings` — one row per (studio, file sha256): `status` READING / READ / FAILED, `reason`
  code, `reading` JSON, `attempts`, `lastAttemptAt` (also the daily-cap count).
- `studio_plan_jobs` — the last read-and-build run per lead file (`fileId` unique): status, the sentence
  shown, the quotation made.
- `studio_quote_plans` — quotation → the lead file its rooms come from.

Plain id columns, no foreign keys, so no existing model was edited (three agents share the schema). RLS on
and `REVOKE ALL … FROM anon, authenticated`, as every table. Rows of a deleted lead file stay (no personal
data in them; the reading is room sizes only).

## Parity built in the same pass

- **Fee 7% for every studio**, on or off per quotation (`pricing.ts FEE_BPS`, `feeBpsOf`); `createQuote`
  snapshots 7%; `saveQuoteTerms` stores 7% or 0; `saveBranding` stores 7% whatever is typed (Settings
  shows 7 and says so). GST stays 18% on/off; the modular discount stays per studio. Quotations already
  made keep their own fee.
- King bed tick, room-wise false ceiling, BHK variant by name, standard selection when nothing is ticked,
  Hauspire's item order, shorter-wall wardrobes, room order ↑↓, "Add to products" for a typed line,
  client mobile and line numbers on the PDF. Full table: [QUOTATION-PARITY.md](QUOTATION-PARITY.md).

## Decisions worth knowing

1. **Model id:** `claude-sonnet-5` is a valid current model (Claude Sonnet 5), so `src/lib/env.ts` was
   **not changed**. `ANTHROPIC_MODEL` still overrides it.
2. **Size from the plan wins over the lead's BHK** (the plan shows the bedrooms); the lead's BHK is the
   fallback. A plan with no readable bedrooms uses the lead's BHK.
3. **False ceiling is on for a plan build** (Hauspire's first quote from a plan includes it); a studio
   with no false-ceiling product gets a note, never an invented rate. Typed ₹/sq ft on the quotation adds
   plain "False ceiling" lines.
4. **Standard selection fallback** fires only when the studio has ticked nothing; any tick wins.
5. **Errors are reason codes**; neither the plan nor the reader's reply is stored in a failure or logged.
6. **Long call:** the read can take up to 45 s inside the lead page's server action. On Vercel this needs
   the function's max duration above that (the default with Fluid compute is fine; the lead page sets no
   lower limit).

## Setup Sanyam does

- Apply `20261012130000_studio_quote_floorplan` to the local test database, then production.
- Add `ANTHROPIC_API_KEY` to `.env.local` and the Vercel project (optional `ANTHROPIC_MODEL`). Without it,
  everything works and builds from the BHK template, saying so.
- The `lead-files` bucket from Phase 1 must exist for plans to be readable (without storage in
  development, uploads are skipped and the read says "We could not open the stored file").

## Checks

- `npx vitest run`: the new suites `tests/studio-quote-floorplan.test.ts` (32) and
  `tests/studio-quote-plan-reads.test.ts` (7) pass; `quote-configure` and `floorplan-sizing` were updated
  for the shorter wall and the standard-selection fallback.
- `npx tsc --noEmit`, `npx next lint`: clean for these files (see the report for failures in other
  agents' areas).
- No browser walkthrough (no dev server or database by instruction).

## Left undone

See "Remaining" in [QUOTATION-PARITY.md](QUOTATION-PARITY.md): 3D view, OCR fallback, approval queue for
new products, non-destructive apply / Villa, Products-page buttons, client folders, electrical bill (owner
to decide). `leads.ts readRoomsOn` (Phase 1) still exists and reads without the cache; nothing on screen
calls it now — it can be removed or pointed at `readPlanOnce` by whoever owns `studio-sales/leads.ts`.
