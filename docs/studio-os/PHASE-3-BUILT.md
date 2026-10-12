# Studio OS — Phase 3 built: Site crews

**Built:** 12 Oct 2026, against [PHASE-3-EXECUTION.md](PHASE-3-EXECUTION.md) (with "Answered by Sanyam")
and Hauspire's own Vendor Ledger ([HAUSPIRE-VENDOR-APP.md](HAUSPIRE-VENDOR-APP.md)), ported, not copied.
**Migration:** `prisma/migrations/20261012180000_studio_crews` — expand only, **not applied** anywhere.
**Rules kept everywhere:** easy, not automatic (the software prices, adds up, refuses mistakes and
reminds on screen; people press every button). Internal only: crews get no app, login or link. Money
in integer paise. PM sees quantities only.

## What was built, and where

| Spec | Where |
|---|---|
| Trades (Hauspire's nine, editable, keys + labels) and routing (studio rows first, then Hauspire's table: exact → canonical → suffix stripped → longest name → keywords → "trade guessed") | `modules/studio-crews/trades.ts`; settings `settings.ts` (`Studio.crewSettings`); Settings → **Crews and trades** `app/studio/settings/trades/*` (owner) |
| Crews: temporary / permanent, several trades, phone, other number, address, since; PAN (format, holder type, unique per studio); Aadhaar (Verhoeff, **last 4 only**); scans + agreement (private bucket `crew-kyc`, ≤ 3.8 MB, JPG/PNG/WebP/PDF, owner + accounts); UPI / bank; notes; archive | `StudioVendor` extended; rules `kyc.ts`; storage `modules/storage/crew-kyc.ts`; writes `flow.ts addCrew / updateCrew / archiveCrew / uploadKycScan`; screens `app/studio/vendors/page.tsx` (list), `[id]/page.tsx` (crew), `CrewForms.tsx` |
| Rate card per crew (sq ft, running ft, point, number, lump sum; blank = agree per job; 0 = no rate) + templates per trade copied on create / "Load template" | `StudioVendorRate` (+ `crewUnit`, `trade`, `sortOrder`, nullable rate); `flow.ts saveRate / deleteRate / loadTemplate`; `CrewForms.tsx RateCard` |
| Project **Crews** tab: build from the design final (else sales final); lines routed to trades → a crew per trade → priced from that crew's card (W × H / 92,903.04 sq ft); carpentry per line **installation only** (₹150/sq ft unless the card says) or **full carpentry** (per sq ft per product type); one work order per crew per project (a crew already on it gets the lines added); due date (+45 days, setting) | `store.ts projectCrews`, `flow.ts buildWorkOrders`, pricing `pricing.ts resolveLine`, plan `rules.ts planFromFinal`; UI `app/studio/projects/[id]/CrewsTab.tsx`, `CrewsPanel.tsx`; tab added in `projects/[id]/page.tsx` |
| Lines: quoted vs measured (measured wins, "more than quoted" flag, variance), estimate for a line with no quantity, agreed amount (wins), rate edited for this project, extras (outside the quote), remove (kept on record), "needs a price / quantity" | `HomeWorkOrderLine`; `money.ts`; `flow.ts setLineQty / setLineCarpentry / setLinePrice / addExtra / removeLine`; `app/studio/vendors/crews-ui.tsx` |
| Statuses draft → issued → in progress → work done (PM's signal to pay) → settled (owner/accounts, only within ₹1); archive; remove only with nothing paid; change crew only with nothing paid (rates not re-priced); link tracker steps | `rules.ts checkStatus / canSwapCrew / canRemoveOrder`; `flow.ts setOrderStatus / editOrder / swapCrew / archiveOrder / removeOrder` |
| Payments: running bills, any amount ≤ balance (+₹1), advances (up to the advance limit ahead of the bill, setting ₹25,000), quick Full / Half / ₹25,000, UPI / bank / cash / cheque, reference, note, date, **recorded by name**; corrections are new rows (append-only) | `HomeCrewPayment`; `money.ts canPayCrew / quickAmounts / canCorrect`; `flow.ts recordCrewPayment` (row lock + re-read in the transaction), `correctCrewPayment`; added to `project/append-only.ts` |
| Statement of account (lines by room, billed, extras, paid, balance; PAN, masked Aadhaar) + print / Save as PDF + **Send on WhatsApp** (opens the studio's own WhatsApp; the link opens only for signed-in owner/accounts) | `store.ts statementOf`; `app/studio/vendors/orders/[id]/statement/*`; `rules.ts statementWhatsApp` |
| Overviews: **Pay these** (largest balance first, due dates, overdue), **Price these** (needs a quantity / a price), **Payments** ledger (by mode), crew ledger (crew page), **Labour vs contract** (owner; warning below target, default 25%) | `store.ts payThese / priceThese / crewPaymentsLedger / labourOverview / crewDetail`; `app/studio/vendors/{pay,price,payments,labour}`, `CrewsNav.tsx`, `orders/[id]` (accounts' way into a work order) |
| Today: PM — lines to measure, work orders whose linked steps are all ticked (mark done); accounts/owner — work done or due within 7 days, with balance | `store.ts crewToday`; `app/studio/vendors/CrewToday.tsx` on `/studio/today` and on accounts' `/studio/payments` |
| Roles (server-side) | `studio/roles.ts`: `crew.list` (owner, PM, accounts), `crew.edit` (owner, accounts), `crew.settings` (owner), `workorder.read` (owner, accounts; PM + supervisor on assigned projects), `workorder.build` (owner; PM assigned), `workorder.money` + `crew.pay` (owner, accounts); `vendor.rates` stays owner (labour vs contract). Money stripped from every PM read (`rules.ts stripMoney`, `viewFor`); PM money writes refused (`setLinePrice` needs `workorder.money`, `addExtra` refuses a rate/amount from a PM). Screens: `surfaces.ts` (accounts opens `/studio/vendors` except `/labour`; PM does not open `/studio/vendors`; `/studio/settings/trades` owner). Accounts' frame gets Payments desk · Crews · Pay crews (`RoleFrame.tsx`). Supervisor sees which crew is on which of their jobs (names only) on site mode's home (`crewsOnMySites`). Designer / sales: nothing |
| Execution payment gates for the client: material procurement → "Material at site…", material dispatch → "Shutters delivered" (studio-editable words; a step's own `gatePayment` wins), Phase 2's `gateOf` | `exec-gates.ts`, `locks.ts`; enforced in `project/site-log.ts` (`postSiteLog` refuses a tick on a locked step with `locked`, 409; `postContext` does not offer it); listed on the Crews tab |
| Nav | "Vendors" renamed **Crews** and switched on (`features.ts vendors: true`, `layout.tsx` one line); Settings tab "Crews and trades" (owner) |
| Events | `project/events.ts`: `crew.ordered`, `crew.order_changed`, `crew.status`, `crew.paid`, `crew.corrected` (internal; no amounts in payloads) |

Tests added: `tests/studio-crews-{kyc,routing,pricing,money,rules}.test.ts` (PAN/Aadhaar/payee/scan
checks; routing order and studio rows; W×H pricing, install vs full, ₹150 default, zero = no rate;
measured/agreed precedence, variance, extras, pending, balance/overpay guard with ₹1 tolerance,
advances, quick amounts, corrections, labour margin; statuses, swap/remove guards, PM money
stripping, role and screen access, settings repair, execution locks). Updated: `studio-roles`
(seven new actions), `studio-team` (role cards), `studio-surfaces` (accounts opens crews),
`studio-guide` (vendors is live).

## Decisions the plan did not settle

1. **Settings in one JSON column** (`Studio.crewSettings`) rather than `StudioTrade` /
   `StudioTradeRoute` tables, like `designTemplate`: trades are keys with labels (rename freely;
   a trade in use can be switched off, never removed). The studio's routing rows sit **on top of**
   Hauspire's table (a switch turns Hauspire's off), so a studio adds only its own names.
2. **One trade, Carpentry**, replaces Hauspire's Modular / Onsite carpentry; the work code only sets
   the line's default mode (MODULAR → installation only, ONSITE → full carpentry). An unrouted line
   goes to Carpentry flagged "trade guessed" and stays ticked in the builder.
3. **Quantity fields:** `qtyMilli` is the quote's quantity or a person's estimate; `measuredQtyMilli`
   is the site measurement and wins. Variance = bill − rate × quoted quantity (extras count in full;
   an agreed amount is its own quoted value), so an estimate is not counted as variance.
4. **Advances** are payments marked ADVANCE that may run ahead of the bill by the studio's advance
   limit (₹25,000 default; 0 = none). A payment never exceeds the balance + ₹1.
5. **Corrections** reverse a whole payment (negative row, `correctsId` unique, once); the right one
   is then recorded again. A correction on a settled work order reopens it as work done.
6. **Settled is marked, not automatic**: owner or accounts press "Mark settled" once the balance is
   within ₹1. Pay these lists any live work order with more than ₹1 owed, whatever its status.
7. **Labour margin** = contract − committed (what the work orders come to now), as a percent of the
   contract; the warning shows when it is **below** the target (default 25%). Material is not
   counted, so it is not profit. Expected = the crews' cost on the quotation's own quantities.
8. **Execution locks match by words at tick time** from the studio's settings (not stored on the
   steps), so the template code the other agent owns is untouched and a studio can change them for
   running projects. A step's own `gatePayment` still wins.
9. **Statement link needs studio sign-in** (owner/accounts). Crews have no login: the studio prints
   it to PDF and forwards that, or reads the figures from the WhatsApp message itself (billed, paid,
   balance are in the text).
10. **Accounts reaches work orders through `/studio/vendors/orders/<id>`** (it does not open
    projects); the PM works them on the project's Crews tab and never opens `/studio/vendors`.
11. The old `StudioWorkOrder` / `StudioVendorPayment` stay as they were: shown read-only at the foot
    of the Crews page (owner); their write actions are gone from the UI.

## Setup Sanyam does

- Apply the migration to the local test DB, then production when ready.
- Supabase → Storage → new bucket **`crew-kyc`**: Private, 4 MB limit, MIME types
  `application/pdf, image/jpeg, image/png, image/webp`, no anon/authenticated policies. Without
  storage keys in development, scans are not stored (`dev-unstored/`).
- Settings → Crews and trades: check the trades, the ₹150 installation rate, 45 days, 25% target,
  the ₹25,000 advance limit, and the two payment locks against your payment stage names.

## Left undone / known limits

- No dev server or database was used (by instruction): not walked through in a browser.
- The Plan tab's office tick (the other agent's file) shows its generic "did not post" message when
  a step is locked by a payment; site mode simply does not offer a locked step. One `case 'locked'`
  in `PlanTab.tsx tickError` would say why.
- The customer's app does not show execution steps as "waiting for payment" (customer views were
  the other agent's area this round); only the studio sees the locks.
- Site mode's "crews on your sites" card is in English only.
- The Overview page's "owed to trades" figure still reads the old vendor ledger.
- No CSV export of crew payments yet; no TDS (owner: not for now); no crew attendance link.
