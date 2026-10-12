# Studio OS — Phase 3: Site crews (vendors)

**For:** Sanyam's go-ahead · **Rewritten:** 12 Oct 2026 · **Reference:**
Hauspire's own Vendor Ledger (docs/studio-os/HAUSPIRE-VENDOR-APP.md)

Owner's rules for this phase (12 Oct 2026):
- **Vendors = the crews who work on site**: carpenters, false ceiling / POP,
  painters, electricians, glass, upholstery, fabrication, civil / plumbing
  (plus "hardware & fittings", billed on invoice). **No factory and no
  material buying** in this phase.
- Crews are **paid per job contract**; margin = the contract against what the
  crews cost (expected, then actual).
- **Easy, not automatic**: people decide; the software prices, adds up and
  reminds on screen. Statements reach crews by the studio sharing them on its
  own WhatsApp. We send nothing.

## Answered by Sanyam, 12 Oct 2026
- **Carpentry: both, chosen per line** — each modular line on a work order is
  either *installation only* (per sq ft, ₹150 default, the units come made)
  or *full carpentry* (per sq ft per product type); manual carpentry priced
  on its own.
- **Running bills**: accounts pays any amount up to the balance as work goes
  on, with optional advances. No fixed parts (the "payment parts" below are
  dropped; the PM's "work done" mark stays as the signal to pay).
- **PM sees quantities only**: the PM builds work orders, picks crews, enters
  measured quantities and extras and marks work done; **rates, amounts,
  balances and payments are owner and accounts only**.
- **No TDS for now.**
- **Internal only**: vendor management is a tool for the studio alone. Crews
  get no app, login or link; the studio records everything and shares a
  statement from its own WhatsApp when it wants to.

## What Hauspire's Vendor Ledger teaches (ported, not copied)

1. Work comes from the **final quotation**: each line goes to a trade; lines
   with width × height price themselves as sq ft × the crew's rate (about 3 in
   4 lines on real flats); the rest are priced by a person.
2. **One work order per crew per project.** Its lines freeze the quote figures
   and the crew's rate when raised; changing a rate card never re-prices old
   work.
3. **Measured beats quoted**, and an **agreed amount beats rate × quantity**;
   measured above quoted shows as variance; work outside the quote is an
   **extra**.
4. Bill, paid and balance are **never typed**: always added up from the lines
   and payments.
5. **Never pay above the balance.** Quick amounts: full, half, ₹25,000.
6. Once anything is paid, the crew can't be swapped and the work order can't
   be removed. Archive, never delete.
7. Two kinds of crews: **temporary** (name and trade) and **permanent**
   (phone, PAN, Aadhaar last 4, scans).

## What gets built

### 1. Trades and crews (Library → Crews)
- **Trades** list, editable, with Hauspire's defaults (Carpentry, False
  ceiling, Painting, Electrical, Glass, Upholstery, Fabrication, Civil &
  plumbing, Hardware & fittings).
- **Crews**: temporary or permanent; one or more trades; phone; for
  permanent, PAN (format and uniqueness checked), Aadhaar (checksum, last 4
  kept only), KYC scans (private, owner/accounts only), agreement; **UPI / bank
  details** for paying; notes; active or archived. Reuses `StudioVendor`.
- **Rate card per crew**: item or trade default, unit (sq ft, running ft,
  point, number, lump sum), rate. Rate templates per trade to start from.

### 2. Routing quote lines to trades (Settings)
- Rules from product name / work code to a trade (Hauspire's routing as the
  default), editable; a "to price" queue for lines that matched nothing.

### 3. Work orders on the project (Crews tab)
- **Build from the design final** (or the sales final): lines grouped by
  trade → pick a crew per trade → lines priced from that crew's rates
  (W × H sq ft where sizes exist), agreed amount optional, due date (default
  +45 days, a setting).
- Lines: quoted quantity · **measured quantity** (variance shown) · rate ·
  agreed amount · amount; **extras** for work outside the quote; "needs a
  quantity" / "needs a price" flags.
- Statuses: draft · issued · in progress · work done · settled; archive.
- The tracker's steps can be linked to a work order (e.g. "Carcass complete
  with hardware" → Carpentry) so the PM sees progress next to the money.

### 4. Paying crews
- **Payment parts** per work order, optional: e.g. 30% at start, 50% at a
  step, 20% at handover; or simply **running bills** (any amount up to the
  balance), as Hauspire does today.
- **Advances** recorded as payments before work is measured.
- **OK to pay**: the PM marks a part or a bill ready (work done, checked);
  accounts pays. Owner can pay directly.
- **Record a payment**: amount (never above the balance), date, mode
  (UPI / bank / cash / cheque), reference, note; recorded **by name**.
- **TDS** (optional, a setting): gross · TDS · net on each payment.
- **Statement of account** per work order (lines, payments, balance), as a
  page and PDF; **Send on WhatsApp** opens the studio's own WhatsApp.

### 5. Overviews
- **Pay these**: work orders with a balance due, largest first, due dates;
  **Price these**: lines needing a price or quantity; **OK to pay** waiting.
- **Crew ledger**: one crew across all projects (billed, paid, balance).
- **Project labour cost (owner)**: contract · expected crew cost · committed
  (work orders) · paid → labour margin; warning below the studio's target.
- Today: PM — parts to mark OK, lines to measure; accounts — payments due.

### 6. Who sees what
- Owner: everything. **Accounts**: crews, KYC, rates, payments. **PM**:
  creates work orders, enters measured quantities and extras, marks OK to
  pay; sees amounts (to be confirmed). **Supervisor**: which crew is on which
  job, no money. **Designer / Sales**: nothing here. Clients: never.

### 7. Execution payment gates (client side)
- Hauspire's material procurement (40%) and material dispatch (40%) open
  their execution steps, with the same lock Phase 2 uses for design.

## Data (expand only; migration not applied to production)
- `StudioTrade`, `StudioTradeRoute`; `StudioVendor` gains kind (temporary /
  permanent), trades, KYC fields (PAN, Aadhaar last 4), UPI / bank, archived;
  rate units extended (point, number, lump sum).
- `HomeWorkOrder` (projectId, vendorId, trade, number, status, dueOn, linked
  stepIds, archivedAt) + `HomeWorkOrderLine` (frozen quote figures, quoted /
  measured qty, rate, agreed amount, extra flag) + `HomeWorkOrderPart` (label,
  % or amount, stepId?, okAt, okBy) + `HomeCrewPayment` (amount, tds, mode,
  reference, note, byId, paidOn) + append-only events.
- `StudioProduct.costPaise` stays for later (material cost is out of scope).
- The old `StudioWorkOrder` on `StudioProject` stays read-only.

## Not in Phase 3
Factory, material purchase orders, GST on crew bills, crew-uploaded bills,
ratings, a no-login crew link, crew attendance payroll.

## Done when (tried with Hauspire)
A permanent carpenter is added with PAN/Aadhaar and a rate card → on a booked
project with its design final, the PM builds work orders, picks the carpenter
for Carpentry, lines price themselves, two lines need a price and are priced
→ the PM enters measured quantities (one shows variance) and an extra → marks
the first part OK to pay → accounts pays ₹25,000 by UPI (refused above the
balance) → the statement goes out on the studio's WhatsApp → the owner sees
the project's labour cost against the contract.
