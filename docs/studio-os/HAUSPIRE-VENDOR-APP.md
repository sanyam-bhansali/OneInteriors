# Hauspire Vendor Ledger: what it does, and what Phase 3 takes from it

**Written:** 12 Oct 2026, a read-only study for Studio OS Phase 3.
**Source:** `C:\Users\sanya\Downloads\Full Hauspire Software\Vendor Management\hauspire-vendor`
(git head `dcd6512 Remove individual lines from a work order`, 21 commits, package
`hauspire-vendor-ledger` 0.1.0). Nothing in that folder was run, installed or
changed. `.env.local` was not opened, and no keys are copied here. The migration
that creates the role accounts (007) holds only `CHANGE-ME` placeholder passwords.

**Vocabulary.** In this app a "vendor" is a **trade or site crew**: a carpenter,
false-ceiling/POP worker, painter, electrician, glass fitter, upholsterer,
fabricator, or civil/plumbing worker. The one exception is the seeded "Hardware &
Fittings" supplier, which bills on invoice. Material suppliers and the factory
are deliberately **not** tracked. FLOW.md says: "material and factory cost aren't
tracked", so "Collected minus paid" would read like profit and isn't.

---

## 1. What the app is

### 1.1 Purpose
The app's own goal (FLOW.md): *"Know what every vendor is owed, on which site, and
never pay twice, or pay for work that wasn't done."*

It reads Hauspire's **final quotation workbook** (.xlsm, Sheet1). For every line
that has `Width(mm) × Height(mm)`, it works out the area
(`W × H / 92,903.04` = sqft) and prices that line against the chosen crew's rate
card. The idea: *"the area the client is billed on is the area the vendor is paid
on."* A person still has to price the lump-sum lines (false ceiling, painting,
electricals, customised work). After that the app records payments against a
running balance.

Validation run over Hauspire's archive (README):

| Measure | Result |
|---|---|
| Workbooks parsed with room blocks | 937 of 943 (99.4%). The other 6 are design-fee quotes |
| Parse errors | 0 |
| Line items read | 25,590 |
| Lines carrying W × H (priced with no measuring) | 14,354 (56.1%) |
| Total area quoted | 2,47,645 sqft |
| Lines the trade router could not place | 260 (1.0%), down from 25.8% before tuning |
| Sample of 5 projects | 120 of 157 work-order lines (76%) priced themselves; 24 needed a quantity, 13 an agreed amount |
| Manual work left per flat | about 6–8 lines |

### 1.2 Stack
- Next.js 14.2.15 (app router, server actions), React 18.3, TypeScript 5.6, Tailwind 3.4.
- Supabase: Postgres, Storage and Auth (`@supabase/ssr` 0.5, `supabase-js` 2.45).
  Every money figure is computed in SQL views.
- SheetJS `xlsx` 0.18.5 reads the workbooks. openpyxl cannot: a doughnut chart's
  `holeSize` fails validation.
- `pdfjs-dist` 4.7 renders the quotation PDF **in the browser** and maps each room
  to its page (`lib/pdf/roomPages.ts`, from the text layer). This avoids any
  server binaries (soffice and pdftoppm are not used).
- Hosting: Vercel Pro with functions in `bom1` (`vercel.json`), and Supabase in
  `ap-south-1` (Mumbai).
- Tenancy: **one deployment per studio**. There is no `org_id`; each settings
  table has a marked seam for adding one later.
- Server actions return `{ ok, message }` where the message has to reach the
  user, because Next hides thrown messages in production. Every page is
  `force-dynamic`. A write revalidates the whole layout so the counts in the rail
  stay right.

### 1.3 Sign-in, roles and users
- **Sign-in:** a username and password against **two shared role accounts**,
  `admin` and `designer`. Supabase stores them as `<username>@hauspire.local`
  (`NEXT_PUBLIC_LOGIN_DOMAIN`); no email is ever sent. Sign-in started as a
  magic link, became a 6-digit email code, then became username and password
  because email needed custom SMTP. The form also accepts real emails, so moving
  to one account per person later needs no code change.
- **Known gap:** `payments.recorded_by` stores the role account's id, so a
  payment shows the role, not the person who released it.
- **Local dev bypass:** `HAUSPIRE_DEV_NO_AUTH=1`. It only works when NODE_ENV is
  not production; the operator is treated as admin and a permanent banner shows.
- **First user rule:** a trigger makes the first person to sign in the admin and
  everyone after a designer. Admins change roles under Settings → People and
  cannot change their own.
- **Roles (`app_role` enum):**
  - **designer:** imports quotations, creates projects, adds vendors to a
    project, adds extra work, enters quantities and estimates, changes due dates.
    Runs the project.
  - **admin:** all of that, plus everything to do with money: line rates,
    agreed amounts, payments, rate cards, vendors and KYC, client payment stages,
    settings, renaming, archiving and deleting, changing the vendor on a work
    order, and removing lines or work orders.
  - A third role, `site` ("records quantities, cannot create payments"), is named
    in a schema.sql comment but was never built.
- **Enforced three times:** `requireAdmin()` in each server action, RLS policies
  (migration 006: everyone signed in can read; designers may write projects,
  quotations, work orders and lines; admins write payments, rate cards, vendors,
  client stages and settings), and a trigger `guard_line_rate` that stops a
  non-admin changing `rate` or `agreed_amount` on a line through PostgREST.
- **Missing role checks:** `upsertRateAction`, `deleteRateAction`,
  `setDueDateAction`, `setLineQuantityAction` and `setStageCollectedAction` do
  not call `requireAdmin`. RLS still limits rate cards and stages to admins.

### 1.4 Navigation
The left rail has four places, "one question each" (`Rail.tsx`):

| Route | The question it answers |
|---|---|
| `/overview` | *What do I have to do right now?* (rail count: none) |
| `/projects` | *What did we agree, and what does this flat owe?* (count: live projects) |
| `/vendors` | *What do we pay this person?* (count: live vendors) |
| `/payments` | *Show me every rupee that went out.* (the audit trail) |

Other pages:
- **Settings** sits at the foot of the rail and only admins see it.
- Not in the rail: `/to-price` (the full pricing queue, "a task, not a place"),
  `/projects/new` (import), `/projects/[id]`, `/vendors/[id]`, and `/archive`
  (the bin, reached from Settings).
- `/work-orders/[id]/bill` sits outside the rail layout and opens in a new tab as
  a printable document.

The rail shows the studio monogram, name and tagline, and the signed-in user with
Sign out. The accent colour comes from settings and is checked again before it
goes into a `<style>` tag.

**Mobile.** There is no app and no vendor-facing portal. The pages are
responsive web (the rail collapses at 900px; `max-[600px]` grids drop to one
column), and wide tables scroll inside a `Scroll` wrapper.

---

## 2. Data model (Supabase Postgres)

Money is `numeric(14,2)` rupees and quantities are `numeric(12,2)`. **Two rules
hold throughout:**
1. **Never store a total.** Bill, paid and balance always come from views.
2. **A work-order line is a snapshot.** It copies the quotation figures *and* the
   vendor's rate at the moment the work order is raised, so later rate-card edits
   never re-price it.

### 2.1 Enums
| Enum | Values |
|---|---|
| `work_code` | `MO-01` (modular, factory-made), `NM-01` (everything else) |
| `rate_unit` | `sqft`, `rft`, `point`, `nos`, `lump` |
| `project_stage` | `Booked`, `Design`, `Execution` (default), `Finishing`, `Handover`, `Closed` |
| `qty_source` | `quote` (from the quote's own dimensions), `estimate` (designer's estimate), `site` (corrected against a site measurement), `invoice` (supplier bills on invoice), `manual` (added by hand) |
| `payment_mode` | `Bank`, `UPI`, `Cash`, `Cheque` |
| `vendor_kind` | `permanent`, `temporary` (migration 003) |
| `app_role` | `admin`, `designer` (migration 002) |
| `trade` | Was an enum; since migration 004 it is the table `trades`. The defaults are Modular Carpentry, Onsite Carpentry, False Ceiling, Painting, Electrical, Glass & Mirror, Upholstery, Fabrication, Civil & Plumbing, Hardware & Fittings |

### 2.2 Tables
**`vendors`**
- Core: `id`, `name`*, `trade`* (primary trade; FK to `trades.name`, ON UPDATE
  CASCADE, ON DELETE RESTRICT), `phone`, `alt_phone`, `email`, `address`,
  `working_since` (free text, e.g. "2021"), `notes`, `is_active`, `archived_at`,
  `created_at`.
- `kind` (`vendor_kind`, default `temporary`).
- Tax, present but unused: `gst_registered` (bool, default false), `gstin`,
  `tds_rate numeric(5,4)`.
- KYC: `aadhaar_last4` (CHECK `^[0-9]{4}$`), `aadhaar_doc`, `pan_number`
  (CHECK `^[A-Z]{5}[0-9]{4}[A-Z]$`, **unique where not null**), `pan_doc`,
  `agreement_doc` (storage paths), `kyc_checked_on`, `kyc_checked_by`.
- CHECK `vendors_permanent_needs_kyc`: kind = temporary OR (phone AND
  aadhaar_last4 AND pan_number).
- **No bank account, IFSC or UPI fields.**

**`vendor_trades`** (vendor_id, trade, PK on both). Every trade a vendor works
in. A trigger always keeps the primary trade in the list.

**`rate_card_items`** (vendor_id, `item`, `unit`, `rate` (null = customised,
agree per work order; CHECK rate null or > 0), `sort_order`; unique (vendor_id,
item)). **The rate card belongs to the vendor, not the trade.**

**`trades`** (`name` PK, `sort_order`, `is_active`). **`product_routes`**
(`product`, `trade`, `match` exact|keyword, `sort_order`, `is_custom`; unique
(product, match)). **`rate_templates`** (`trade`, `item`, `unit`, `rate`,
`sort_order`; unique (trade, item)). A template is copied onto a vendor once,
when the vendor is created.

**`settings`** is a single row (boolean PK `id = true`):
- `studio_name` (Hauspire), `studio_tagline` (Vendor Ledger), `accent_hex`
  (#d2703f, CHECK hex), `logo_path`.
- `default_due_days` 30 (0–365), `tds_rate` (0–30%), `payment_modes`
  (UPI, Bank transfer, Cash, Cheque), `sqft_divisor` 92903.04, `updated_at`
  (trigger).
- `default_due_days`, `tds_rate` and `payment_modes` are saved but **not read**
  by any money screen; see §3.13.

**`projects`**:
- `client`*, `name`* (unique among **live** projects, case-insensitive:
  migrations 011 and 015), `mobile`, `flat`, `location`, `bhk`, `stage`.
- `owner_id` (the designer who imported it), `archived_at`, `created_at`.

**`quotation_revisions`**:
- Identity: `project_id`, `label` (e.g. "Final quotation"), `issued_date`,
  `is_final` (**one final per project**, partial unique index).
- Files: `source_file`, `pdf_path`, `design_pdf_path` (the 3D design PDF),
  `page_paths`, `room_page` jsonb (room → PDF page).
- Totals as printed: `total_mo`, `total_nm`, `fee`, `sub_total`,
  `discount_rate` (read from the sheet, never assumed), `discount_value`, `tpv`
  (total project value).
- `warnings[]`, `imported_at`.

**`quotation_lines`** (revision_id, `room`, `serial`, `product`, `code`,
`details`, `width_mm`, `height_mm`, `sqft`, `amount` = what the **client** pays,
`sort_order`). **`quotation_rooms`** (room, printed `subtotal`).
**`client_payment_stages`** (revision_id, `label`, `detail`, `amount`,
`collected` bool, `collected_on`). This is money coming in, read off the
quotation's Payment Stages block.

**`work_orders`** (one per vendor per project; unique (project_id, vendor_id,
trade), and enforced by the actions as one per (project, vendor)):
- `project_id`, `revision_id` (the final quotation it was built from),
  `vendor_id`, `trade` (the vendor's primary trade).
- `issued_date` (today by default), `due_date`* (stored but drives nothing).
- `retention_rate` (present, unused), `notes`, `created_at`.

**`work_order_lines`**:
- Link: `work_order_id`, `quotation_line_id` (SET NULL if deleted).
- Quote snapshot: `room`, `product`, `code`, `width_mm`, `height_mm`, `sqft`,
  `quoted_amount` (the client's value for this line).
- Rate snapshot: `item`, `unit`, `rate` (null = no standard rate),
  `rate_edited` (differs from the card for this project only).
- Quantity and money: `qty` (from the quote, or the designer's estimate),
  `qty_measured` (**the site correction, which wins over qty**),
  `agreed_amount` (**overrides rate × qty entirely**), `source` (`qty_source`).
- `is_extra` (work agreed after signing; carries no quoted_amount),
  `sort_order`.

**`payments`**:
- `work_order_id`, `paid_on` (today by default), `amount` (CHECK > 0; the **net
  released**), `mode`, `note`, `reference` (UTR or cheque number; the column
  exists but the payment dialog never sends it).
- `tds_deducted` (present, unused), `recorded_by` (user id), `created_at`.

**`profiles`** (`id` = auth user, `email`, `full_name`, `role`).

### 2.3 Views: all the money maths
```
v_work_order_lines (every line):
  effective_qty         = coalesce(qty_measured, qty)
  line_amount           = coalesce(agreed_amount, coalesce(rate,0) * coalesce(qty_measured, qty, 0))
  line_amount_as_quoted = 0 if is_extra else coalesce(rate,0) * coalesce(qty,0)
  pending               = null      if agreed_amount is not null
                          'amount'  if rate is null
                          'qty'     if effective_qty is null
                          else null

v_work_orders (each work order):
  bill           = Σ line_amount
  bill_as_quoted = Σ line_amount_as_quoted
  extras         = Σ line_amount where is_extra
  variance       = bill − bill_as_quoted   (site measurement or extras above the quote)
  client_value   = Σ quoted_amount
  pending_lines  = count of lines with pending set
  paid           = Σ payments.amount
  balance        = bill − paid

v_projects (each project):
  vendor_bill, vendor_paid, vendor_balance, vendor_extras, pending_lines
                 = sums over its work orders
  tpv            = the final revision's tpv
  collected      = Σ final revision's client stages where collected
```
An unpriced line adds ₹0 to the bill, so the screens always show
"+N to price" beside a total.

### 2.4 Functions, triggers and storage
- `project_is_empty(pid)` and `vendor_is_empty(vid)`: no work orders and no
  payments. They decide whether **permanent delete** is offered and are checked
  again inside the delete.
- `is_admin()`, `handle_new_user()` (first sign-in becomes admin),
  `sync_primary_trade()`, `guard_line_rate()`, `touch_settings()`.
- Storage buckets, both private: `quotations` (PDFs, any signed-in user, reached
  only through signed URLs valid for 1 hour) and `vendor-kyc` (**admin-only** read
  and write).
- Migration 014: **a rate of 0 is not a rate.** All zero rates became null and
  CHECK `rate > 0` was added on lines, cards and templates. A zero would make a
  line look priced at ₹0 and vanish from the bill.

---

## 3. Screens and features in detail

### 3.1 Overview (`/overview`): the daily worklist
- **Header:** today's date as the eyebrow; title "Overview"; sub "What needs
  doing today, across every live flat."
- **Getting started** (shown only while there are no vendors or no projects):
  1. Add your vendors and their rate cards
  2. Import a final quotation
  3. Price what didn't price itself
  4. Record a payment
- **Three figures (KPIs):**
  - **Outstanding to vendors** = Σ balance over work orders with balance > ₹1.
    Note: "N open work orders".
  - **Extra work** = Σ `extras` over all work orders. Note: "beyond the
    quotation, on N work orders" (orders with extras > ₹1). Shown in the alert
    tone when above ₹1.
  - **Still to price** = count of pending lines. Note: "X need a quantity, Y
    need an amount".
- **Pay these:** every work order with balance > ₹1, **largest balance first**.
  Columns: Vendor (link, trade below) · Client · Billed · Paid · Balance · a
  paid-against-bill meter · **Pay** button. Pay opens the Record payment dialog
  (§3.10). It used to sort overdue orders first; that was removed because nobody
  maintained the due dates.
- **Price these:** the first 6 "Needs a quantity" lines and the first 6 "Needs an
  agreed amount" lines, with "See all N →" linking to `/to-price`. Help text:
  "The quotation priced these as a lump sum… Put in an estimate — site
  measurement can correct it later."
- **Projects:** a table of Client (with location), Stage, Quoted (tpv), Vendor
  bill, Balance and a meter.
- **Taken out on purpose:** a money-in/money-out strip (misleading without
  material cost), "Overdue" and "Due this month" (based on an unmaintained date),
  and trade colours.

### 3.2 Projects (`/projects`) and import (`/projects/new`)
- **List:** cards showing the name (with the client if different), BHK,
  location, stage tag, Quoted, Vendor bill, Balance, a meter, "N lines to price ·
  added <date>". Button: **Add project**.
- **Import step 1, "The documents":**
  - Final quotation (.xlsm) is required. The quotation PDF as issued and the 3D
    design PDF are optional.
  - Button **Read quotation**. The workbook is parsed on the server and nothing
    is saved yet.
  - The PDF is read locally to build the room → page map.
- **Import step 2, review:**
  - Figures: Client, Quoted (tpv), Vendor cost (total of all ticked lines).
  - Importer warnings are always shown, never hidden.
  - **Project details:**
    - Project name: defaults to "Client — Flat"; a flat of N/A, NA, - or nil is
      treated as empty; must be unique among live projects.
    - Quotation label: default "Final quotation".
    - Issued on: today.
    - Configuration: 1 BHK / 2 BHK / 3 BHK (default) / 4 BHK / Villa / Office.
    - **Vendor payment due:** today + **45 days**. This is hard-coded; the
      settings value of 30 is ignored.
    - Stage: Execution. The revision is always saved as final.
  - **Who does what:**
    - Lines are grouped by trade (§3.4). Each group has a **Vendor** picker
      ("Skip this trade for now" is an option), defaulting to the first live
      vendor who does that trade.
    - Each line is listed with an include tick, the client ₹, the size, an
      editable rate, an editable qty and the vendor ₹, plus **+ Add item** (a
      hand line, saved as `is_extra`).
    - **Lines whose trade was only guessed from the work code are tagged "trade
      guessed" but stay ticked by default.** The reasoning: leaving out a line is
      the more expensive mistake, because the work happens and nobody is billed.
      The tag tells the reviewer to fix the route under Settings → Product
      routing.
    - Pricing runs in the browser (pure functions), so every edit recalculates
      straight away.
  - **Create project:**
    - Order of writes: project → revision → rooms → lines → client stages →
      one work order per vendor.
    - Assignments are **merged per vendor**, so a multi-trade carpenter gets one
      work order.
    - **If any step fails, the project just created is deleted** (rollback).
      Adding a revision to an existing project never deletes it.
    - Name clash: "A project called … already exists (added <date>). Give this
      one a name that tells them apart — the flat or the locality usually does
      it."

### 3.3 Project page (`/projects/[id]`)
- **Header:**
  - Name, which admins can rename (≤ 120 characters, unique among live
    projects).
  - Sub-line: client · BHK · location · stage · "final quotation <date>".
  - Actions: Archive / Restore / Delete (admin), **Add vendor**, and a
    "To price · N" badge.
- **Figures:**
  - **Total project value**, with "MO ₹x · NM ₹y · fee ₹z" below.
  - **Collected**: Σ client stages marked collected, "n of N stages".
  - **Vendor bill**: "N trades · site labour only".
  - **Balance to vendors**: "₹x paid".
  - **Extras beyond the quote**: shown when above 0, "work the client never
    signed for".
- **Vendor work orders:** the shared `WorkOrders` component (§3.6). Empty text:
  "Use **Add vendor** above — the quotation lines for their trade come
  pre-ticked and priced against their rate card."
- **What changed:** a diff of the first revision against the final, matched on
  room and product.
  - Rows are tagged changed (size `1800×600 → 1350×600` and/or amount), added
    ("not in the first quotation") or removed ("dropped after design"), with the
    net value movement.
  - It exists to show why work orders come **only from the final**. The worked
    example: a master wardrobe went 1800 → 1350 mm and a kitchen loft was
    dropped.
- **Quotation & design:** the importer's reading on the left and the PDF on the
  right; opening a room jumps the PDF to that room's page. A 3D design tab is
  also available.
- **Client payment stages ("money in"):** Stage · Amount · Received/Pending,
  with "Received to date". The action that marks a stage collected exists
  (`setStageCollectedAction` stamps `collected_on` = today), but this page shows
  the stages read-only.

**Add vendor to a project** (dialog "Add a vendor to this project"):
- The vendor picker leaves out vendors already on the project. "Payment due by"
  defaults to today + 45 days.
- The server reads the **final** revision and routes every line to a trade. It
  keeps lines in **any of this vendor's trades** that are **not already on
  another work order of this project** (so nothing is billed twice), and prices
  each one against this vendor's card.
- Lines the router was sure of start ticked; guessed lines start **unticked**
  (the opposite of the import screen).
- The rate on each line is editable "for this project only". The footer shows
  the work-order total, "n lines · client value ₹x · k still to price", and
  **Add vendor**.
- Refused with: "That vendor is already on this project. Add the work to their
  existing work order instead, so their balance stays in one place." Also
  refused when there is no final quotation.

### 3.4 Trade routing: quotation line → crew
`routeProduct(product, workCode)` tries these in order:
1. exact name
2. canonical name (letters and digits only)
3. with a context suffix stripped ("-(Kids Bedroom)", "- 3BHK", "(2 nos)")
4. longest master name of at least 9 characters that contains it or is
   contained by it
5. ordered keyword rules
6. the work-code fallback: MO-01 → Modular Carpentry, NM-01 → Onsite Carpentry.
   This result is flagged "trade guessed".

The shipped table holds Hauspire's 53 ProductMaster names plus about 40 names
from the archive, typos kept as typed ("Crcokery Unit", "Paiting -3bhk",
"Service Platfrom Creation").

| Trade | What routes there |
|---|---|
| Modular Carpentry | Base and wall cabinets, wardrobes, lofts, crockery, vanity, beds (hydraulic), workstation, study, storage, dry-balcony units, bar unit |
| Onsite Carpentry | Mandir, TV unit, partition, décor walls, bay window, window seat, breakfast counter, foldable dining, Bed/Murphy bed (TO CONFIRM) |
| Hardware & Fittings (invoice) | Tandems, sliding mechanism, Appliance Unit (TO CONFIRM) |
| Glass & Mirror | Dressing mirror, glass-profile shutters |
| Upholstery | Headboard, sofa cum bed, day bed, sofa, seating |
| Fabrication | Safety door, window frame, iron table, staircase |
| False Ceiling, Electrical, Painting | Their named lump-sum lines |
| Civil & Plumbing | Civil & plumbing changes, granite, platform, sink, wall break |

The keyword rules, in order:
1. hardware / tandem / slide mechanism / hinge / channel
2. vanity
3. glass / mirror
4. headboard / cushion
5. safety door / MS / railing / grill
6. false ceiling / gypsum / POP
7. electr
8. paint / polish / texture
9. civil / plumb / granite / platform / dado / tile / marble
10. onsite décor words
11. factory-unit words (last)

13 names are flagged for the studio to decide (Sliding Door, Main Door, Acrylic,
Laminate Change and others). Studios can edit the routes in Settings → Product
routing (exact or keyword).

### 3.5 Pricing a line against the crew's rate card (`resolveLine`)
Each trade has an ordered list of resolvers, `{when product regex, needsSqft,
item, alias, qty: sqft|one|none, source}`:

| Trade | Resolvers, in order |
|---|---|
| Modular Carpentry | loft + sqft → "Loft Installation" × sqft; any + sqft → "Modular Installation" × sqft; bed → "Hydraulic Bed Assembly" × 1; workstation/dressing → × 1; vanity → × 1; else "Customised Work" (no qty, estimate) |
| Onsite Carpentry | sqft → "Manual Carpentry" × sqft (alias manual\|onsite, deliberately *not* /carpent/); else Customised Work |
| Glass & Mirror | mirror + sqft → "Mirror 5mm Edge Polished" × sqft; mirror without size → same item, qty needed; shutter → "Glass Profile Shutter" × 1; else "Toughened Glass Partition" (qty needed) |
| Upholstery | headboard → "Cushion Headboard" × 1; else "Bed / Sofa Upholstery" × 1 |
| Fabrication | door → "MS Safety Door" × 1; else "MS Structure / Railing" (qty needed) |
| False Ceiling | "Plain Gypsum Ceiling", qty needed |
| Electrical | "Point Wiring", qty needed |
| Painting | polish → PU Polish; texture → Texture Finish; else "Putty + Primer + 2 Coats" (all need qty) |
| Civil & Plumbing | granite/platform → rft; plumb → point; else "Civil Breaking & Making" (all need qty) |
| Hardware & Fittings | "Supplied on invoice" (source invoice; the amount is typed) |

**Finding the rate-card row**, widest match last:
1. exact (ignoring case)
2. canonical
3. the resolver's alias regex
4. a shared "significant word" of 6 or more characters that is not filler (work,
   unit, installation, assembly, custom, charges, labour…)

Two passes over the resolvers: first the most specific resolver **the vendor
actually has a rate for**, then the most specific overall with rate null.
A rate of 0 on a card is treated as null ("needs ₹"). A trade added in Settings
with no resolvers gives an unpriced "Customised Work" line.

### 3.6 Work orders (the `WorkOrders` component, on the project and vendor pages)
- **Order:** sorted by bill, largest first, and split into **running** (anything
  not Settled) and **settled**, which folds away under "Show N settled work
  orders — ₹x billed in total".
- **Running total row at the top:** Billed, Paid, Balance and a meter across
  running work only, plus "N open work orders · k to price".
- **Each row:**
  - Trade (or client on the vendor page) and vendor name.
  - Status pill: "To price" if **every** line is pending; "Settled" if
    `bill − paid ≤ ₹1`; otherwise "Open", which shows no badge.
  - A "change" link: move the work order to another vendor (admin, and only if
    nothing has been paid).
  - Billed with "+N to price", Paid, Balance, meter.
- **Expanded row:**
  - **Line table:** Quotation line (room heading, product, MO-01/NM-01 or
    "extra", "rate edited") · Client ₹ ("not quoted" for extras) · Size (sqft)
    · Vendor rate (item, then an admin-editable rate saved on blur with
    "/unit", or "no rate") · Qty ("needs qty" / "needs ₹" / "agreed" / qty unit)
    · Vendor ₹ · a remove icon (admin; two clicks, "sure?" disarms after 4 s).
  - **Variance warning** when `variance > ₹1`: "₹x above the quoted quantity.
    Site measurement exceeded what the quotation allowed for — approve the
    variance before releasing the next payment." This is advice only; payment is
    **not** blocked.
  - **Payments** sub-table: date · note · mode · amount.
  - **Buttons:** Record payment (admin, when balance > ₹1) · Update quantities
    · Add extra work · **Create bill** (new tab) · Remove (admin; disabled with
    a reason once anything is paid) · Open <vendor>.
- **Update quantities** dialog ("Quantities — <trade>"):
  - The quote quantities come pre-filled. For each line: Line · Quoted · Actual
    (an input) · Vendor ₹, with "Revised bill ₹x" at the bottom.
  - Saving writes `qty_measured` with source `site` for lines that have a rate,
    and `agreed_amount` for lines without one (admin only).
  - **This is the only measurement or BOQ step.** There are no separate
    measurement sheets, no photos, and no sign-off.
- **Add extra work** dialog:
  - "What was done", Room (optional), then **Rate × quantity** (rate, unit
    sqft/rft/point/nos, qty) or **Lump sum** (agreed amount).
  - The footer shows "Adds ₹x to <vendor>'s bill".
  - Saved with `is_extra`, `quoted_amount` null, code NM-01, source manual.
    It must have either rate and qty, or an amount.
- **Change vendor** dialog:
  - Refused if anything has been paid ("the payment history would then point at
    someone who was never paid").
  - Refused if the new vendor already has a work order on the project.
  - **Rates are not re-priced** to the new vendor's card.
- **Remove line:** allowed even after a part payment; the bill recomputes.
- **Remove work order:** refused once anything has been paid.

### 3.7 To price (`/to-price`) and the pricing queue
These are all lines with `pending` set, across every project, in two tables:
- **Needs a quantity:** Client · Quotation line (room · trade) · Client ₹ ·
  Vendor (item) · Rate/unit · "Enter qty". Saved on blur or Enter, must be
  > 0, written as `qty_measured`, source `estimate`.
- **Needs an agreed amount:** the same columns with "Enter ₹", written as
  `agreed_amount` (admin).

A saved row fades out. This is "the whole manual workload the system leaves".

### 3.8 Vendors (`/vendors`): onboarding and KYC
- **List:**
  - Eyebrow: "N vendors · T trades · K with incomplete KYC".
  - Sub: "Each vendor holds their own rate card. Two carpenters can price the
    same item differently…"
  - Columns: Vendor (with "since <year> · phone" and an alert such as "Missing
    Aadhaar, PAN") · Trade (and a Temporary tag) · Rate items · Work orders ·
    Billed · Balance · Open/Settled.
  - **Add vendor** (admin).
- **Add a vendor** dialog: it opens in **temporary** mode. The reason given:
  most crews arrive mid-job with only a phone number, and demanding an Aadhaar
  then "gets you a fake Aadhaar".
  - **Type:** temporary ("A one-site hire. Nothing but a name and trade is
    required") or permanent ("Someone you use repeatedly. Their identity is
    recorded and they keep a rate card").
  - Name*, Trade* (from Settings), Phone (required if permanent), Additional
    number ("Supervisor, brother, whoever picks up"), Email, Working since,
    Address.
  - Permanent only: **PAN** and **Aadhaar** (12 digits).
  - On create, the trade's **rate template is copied** onto the vendor's card.
- **KYC rules (`lib/kyc.ts`), enforced in the form, the action and the database:**
  - **PAN:** upper-cased with spaces removed; exactly 10 characters; pattern
    `AAAAA9999A`; the 4th character must be a known holder type (P Individual, C
    Company, H HUF, F Firm, A AOP, T Trust, B BOI, L Local authority, J
    Artificial juridical person, G Government). The holder type is shown beside
    the field. A PAN must be unique across vendors.
  - **Aadhaar:** 12 digits, not starting 0 or 1, and must pass the
    **Verhoeff checksum**. Only the **last 4 digits are stored**, and the full
    number never reaches the database or the logs. It shows as
    `XXXX XXXX 1234`, with no reveal. The stated reason: under the Aadhaar Act,
    holding full numbers is a liability that buys nothing.
  - **Permanent needs** phone, Aadhaar and PAN; otherwise: "A permanent vendor
    needs … Save them as temporary instead if you do not have these yet."
  - **Gaps:** *blocking* (phone, Aadhaar or PAN missing) and *soft* (number on
    file but no scan). The summaries read "Temporary", "Missing …", "No Aadhaar
    card scan or PAN card scan", or "KYC complete".
  - **Documents:** three slots (Aadhaar card, PAN card, Agreement), each a
    JPEG/PNG/WebP/PDF of at most 8 MB, stored in the private `vendor-kyc`
    bucket at `<vendorId>/<doc>-<timestamp>.<ext>`. Admin only; "Attach" or
    "Replace". **The agreement is never required.**
  - **Make permanent** (temporary → permanent): asks for phone, Aadhaar and PAN,
    and stamps `kyc_checked_on` = today and `kyc_checked_by`. History carries
    over.
- **Not captured at all:** bank account, IFSC, UPI ID, GST registration (the
  columns exist but there is no UI), address proof, photo, emergency contact,
  skill level, team size, or police verification.

### 3.9 Vendor page (`/vendors/[id]`): rate card and ledger
- **Header:** name; sub "trade · working with us since <year> · phone";
  Archive / Restore / Delete (admin; delete only when the vendor has no work
  orders and no payments).
- **Figures:** Total billed ("N work orders"), Total paid ("N payments"),
  **Running balance** = billed − paid ("across N open work orders" or
  "everything settled").
  - Work orders on **archived projects are left out** of these figures and
    lists.
- **Vendor details:** a Contact card and an Identity card (Permanent/Temporary,
  Aadhaar masked, PAN with its holder type, Checked date, a gap note), the three
  document slots, and **trades** (multi-select of all trades).
  - A trade cannot be removed while the vendor has work orders in it.
- **Rate card** (`RateCardEditor`):
  - Each row: Item (with a datalist of the names the resolvers look for, e.g.
    "Modular Installation"), Unit (sqft, rft, point, nos, lump sum), Rate
    (blank = "no rate"), ✕. Rows save on blur.
  - "+ Add item"; "Load template" when the card is empty.
  - A note lists items "named differently from what the importer looks for".
  - Editing the card changes only **new** work orders.
- **Work orders across every site:** the same component as on the project page,
  showing the client.
- **Payment ledger:** Date · Client · Note · Mode · Amount, newest first.
  **This is the vendor's statement on screen.**

### 3.10 Payments: recording and the audit trail
- **Record payment** dialog: admin only; opened from Overview → Pay, a work
  order, or a vendor.
  - Context line: "<Vendor> · <trade> · <client>. Balance ₹x of ₹y billed."
  - **Amount:** pre-filled with the full balance; quick buttons **Full
    balance**, **Half**, **₹25,000** (capped at the balance).
  - **Date:** today. **Mode:** Bank, UPI, Cash or Cheque (default Bank;
    hard-coded, not from settings). **Note:** default **"Running bill"**.
  - The footer shows "Balance after ₹x".
- **Rules:**
  - The amount must be > 0.
  - **The work order cannot be overpaid:** amount > balance + ₹1 is refused
    with "That is more than the ₹x outstanding on this work order."
  - `recorded_by` is the signed-in user (the role account).
  - Payments can be any amount on any day; the balance recomputes. **There is no
    payment approval step, no maker/checker, no schedule of parts, no link to
    milestones, and no edit or delete of a payment in the UI.**
- **Payments page (`/payments`):**
  - Eyebrow "N entries"; sub "Every rupee released to a trade, newest first."
  - Figure **Total released**, with a split by mode (e.g. "Bank ₹2.1L · UPI
    ₹40k").
  - Ledger table: Date · Vendor (trade) · Client · Note · Mode · Amount.
  - The latest 400 only. **No filters and no export**, although FLOW.md says the
    accountant needs it "flat and exportable".

### 3.11 The bill / statement of account (`/work-orders/[id]/bill`)
A printable A4 page; the user prints or uses "Save as PDF". There is no PDF
library. It is explicitly *"a statement of account, not an invoice — Hauspire is
the payer… the vendor raises their own invoice"*, and carries no tax fields and
no invoice number.
- **Header:** studio name and "Vendor statement of account"; "Work raised" date.
- **Vendor block:** name, trade, phone, address, PAN, Aadhaar (masked).
- **Site block:** client, flat, Reference (the first 8 characters of the work
  order id, upper-cased).
- **Lines grouped by room:** product (with an "extra" tag), item; Rate
  (₹/unit); Qty ("agreed" or "—" when pending); Amount.
- A notice when lines are unpriced: "This statement is provisional until they
  are settled."
- **Totals:** Total billed · "of which extra work" · Paid to date (−) ·
  **Balance due**.
- **Payments received:** date · note · mode · amount.
- **Footer:** "Statement generated … Please raise any disagreement before
  accepting payment."

### 3.12 Archive (`/archive`)
- Archived projects keep their figures (Quoted, Vendor bill, Balance) and can be
  restored. Restoring is refused if a live project has since taken the name.
- Archived vendors leave the pickers; their past bills still read correctly.

### 3.13 Settings (admin)
Each panel saves on its own.
- **Trades:** add, rename (cascades to vendors and work orders), switch off
  ("Shown"), delete (refused while in use: "Switch it off instead"), reorder.
  Shows vendor counts.
- **Product routing:** Product · Match (exact/keyword) · Trade. Edited rows are
  marked `is_custom`.
- **Rate templates** per trade: item, unit, rate.
- **Studio:**
  - Name, tagline, accent colour (#hex).
  - **Default due days** (0–365): "How long a vendor has to be paid, from the
    day a work order is raised."
  - **TDS rate %** (optional, 0–30): "Leave blank if you do not deduct TDS."
  - **Payment modes** (comma-separated).
  - The last three are saved but not used by the money screens.
- **People:** Person · Role (Designer/Admin). "The first person to sign in
  becomes the admin."

### 3.14 Features the app does **not** have
These matter for the mapping in §5:
- **Attendance:** none. No crew members, no days on site, no headcount.
- **Milestones and stage-linked payments:** none. Payment is "any amount, any
  day". Client payment stages exist only on the income side.
- **Approvals:** none in software. The variance warning is advice; there is no
  maker/checker on payments.
- **Advances:** not modelled. Paying before work is priced is impossible (a
  zero bill cannot be paid). An "advance" is simply an early payment against
  the work order's balance.
- **Vendor bills and invoices:** none. The vendor's own invoice is not
  recorded; the app only prints its statement.
- **Deductions, retention and penalties:** none. `retention_rate`,
  `tds_deducted`, `tds_rate`, `gst_registered` and `gstin` are columns
  "carried, unused". The README says that if TDS is deducted, gross, TDS and
  net must be three columns before the first real payment. **GST and TDS maths
  is not implemented anywhere.**
- **Ratings and quality checks:** none.
- **Site allocation and scheduling:** the work order *is* the site allocation
  (vendor × project). There is no calendar, crew dates or capacity.
- **Notifications and WhatsApp:** none. No messages, email or reminders; the
  only reference to WhatsApp is a comment that a PAN often arrives by WhatsApp.
- **Exports:** only the printable bill. There is no CSV or Excel export and no
  Tally.
- **Vendor portal or app:** none. Vendors never log in.
- **Due dates and overdue:** `due_date` is stored but drives nothing
  ("Overdue" was removed deliberately).

---

## 4. Background jobs and integrations

- **Background jobs:** none. No cron, no queues, no webhooks.
- **Scripts (`scripts/`, run by hand with `tsx`):**
  - `seed:vendors` loads 11 sample crews and their rate cards from
    `src/lib/rates.ts`. **Only ₹150/sqft modular installation is confirmed**,
    and it covers installation only (the README: "the factory makes the units
    and Hauspire buys the material"). Every other rate is a placeholder.
  - `seed:settings` copies the shipped trades, routes and templates into the
    database and never overwrites custom rows.
  - `validate:archive <dir>` runs the importer over the whole quotation archive.
  - `smoke:import <file>` imports a single workbook.
  - `postinstall` copies the pdf.js worker into `/public`.
- **Integrations:**
  - Supabase Auth, Postgres and Storage only.
  - Quotations come in as files exported by hand from Excel, which the app never
    writes back to.
  - No payment gateway, no bank or UPI API, no GST lookup, no WhatsApp, no
    email.
- **Importer behaviours worth keeping (`parse.ts`):**
  - Serial numbers typed as text (about 6% of workbooks) are still read as
    lines.
  - It uses cached values rather than formulas (whatever the designer typed
    over a formula is what was quoted).
  - Product and room names have their whitespace collapsed.
  - Shifted columns are flagged.
  - On a **handover quotation**, the importer reads the **right-hand
    "final/as-built" Width, Height and Amount** columns, not the original ones.
  - Discount is read from the sheet, never assumed (10% in 279 quotes, 15% in
    223, 5% in 173, 0% in 119). The professional fee is consistently 7%.
  - 48 archived workbooks have a room sub-total that disagrees with their own
    lines; these are shown as warnings.

---

## 5. Mapping: Hauspire vendor app → One Interiors today → Phase 3

**What One Interiors has today (read from the worktree):**
- `StudioVendor` (name, trade, phone, gstin, notes, isActive; unique per studio
  by name) and `StudioVendorRate` (item, `QuoteUnit` AREA/SQFT/RFT/UNIT,
  ratePaise).
- `StudioWorkOrder` (on the **old `StudioProject`**, with trade, issuedOn,
  dueOn, notes) and `StudioWorkOrderLine` (description, unit, qtyMilli, a
  **snapshot** ratePaise, amountPaise).
- `StudioVendorPayment` (paidOn, amountPaise, mode BANK/UPI/CASH/CHEQUE,
  reference, note).
- `ledger.ts`: `workOrderMoney` (bill, paid, balance, settled, `overpaidPaise`
  reported rather than clamped) and `canPay` (refuses non-positive amounts, a
  zero bill, and overpayment).
- The `/studio/vendors` screen sits behind `isLive('vendors') = false`, and
  `vendor.rates` is owner-only.
- `StudioCrewMember` (name, role, phone, active) and `HomeSiteLogCrew` (crew
  name and role copied at posting, `arrivedAt`, per daily `HomeSiteLog`).
- `HomeChecklistItem` steps with `weightBp`, an in-scope flag, and a tick that
  needs a photo, plus `gatePayment`/`responsible` from Phase 2.
- `HomeProjectPayment` (money in, with correction rows).
- `StudioQuoteLine` (room, product, code MODULAR/ONSITE, widthMm, heightMm,
  qtyMilli, rate, amount) with sales-final and design-final revisions.
- Roles: OWNER, PM, SUPERVISOR, ACCOUNTS, SALES, DESIGNER.

**Priority** assumes a studio that pays site crews **per job contract, in
parts**, with no factory.

| Hauspire vendor app feature | One Interiors today | Status | Phase 3 should build | Priority |
|---|---|---|---|---|
| Trades as an editable list (add, rename, switch off, order) | `trade` is free text; a `COMMON_TRADES` vocabulary exists | Partly | Studio trade list for crews (carpenter, POP/false ceiling, electrician, painter, civil/mason, plumber, fabricator, glass, upholstery, other) | Must |
| A vendor can do several trades | One `trade` string | Missing | `trades String[]` or a join table; primary trade kept for labels | Should |
| Permanent vs temporary vendor | None | Missing | `kind` field; temporary needs only name and trade | Must |
| Contact: phone, alternate phone, email, address, working since | phone, notes | Partly | Add alt phone, address, working since (email optional) | Must |
| KYC: PAN (format, holder type, unique), Aadhaar last 4 (Verhoeff), document scans, agreement optional | gstin only | Missing | Port `kyc.ts` as is (keep "last 4 only"); private KYC files in the locker, owner and accounts only | Must |
| Bank, IFSC, UPI for paying crews | None (and none in Hauspire) | Missing | Add payee details (UPI ID, or account + IFSC); accounts sees them; shown on the payment screen | Should |
| GST registered / GSTIN | `gstin` | Partly | Keep; only matters if a crew bills with GST | Later |
| Per-vendor rate card (item, unit, rate; blank = customised) | `StudioVendorRate` | Have | Add units **point** and **nos/job** and **lump**; treat 0 as no rate; allow a blank rate | Must |
| Rate templates per trade, copied on create | None | Missing | Trade templates copied (never linked) onto a new crew | Should |
| Work order per vendor per project, lines snapshotted from the final quote | `StudioWorkOrder` on old `StudioProject` (switched off) | Partly | **Job contract** (`HomeLabourJob` in the draft) on `HomeProject`, one per crew per project, lines copied from the **design final** (else sales final), rate snapshotted | Must |
| Auto-routing quote lines to trades, priced by W×H sqft | Quote lines carry widthMm/heightMm/code/qtyMilli | Partly | Suggest lines per trade (port `routeProduct` + `resolveLine` against the product master's category); one click to accept; "guessed" flag | Should |
| Lump-sum job contract ("Carpentry — all rooms ₹1,40,000") | Line `amountPaise` override exists | Partly | A job can be a single agreed amount or rate × qty lines | Must |
| Rate edited for this project only ("rate edited" tag) | Snapshot rate | Partly | Flag a line whose rate differs from the card | Should |
| Quoted qty vs measured qty (site wins); variance warning | `qtyMilli` only | Missing | `qtyMeasuredMilli` and source (quote/estimate/site); a **variance** figure; a warning before the next part is paid | Must |
| Extras (work beyond the signed quote, no client value) | None | Missing | `isExtra` lines; extras total on the job, project and owner margin; ideally linked to `HomeQuoteChange` | Must |
| "To price" queue (needs qty / needs ₹) | None | Missing | A queue on the PM's Today page: lines with no rate or no qty | Should |
| Milestones / payment in parts | None for crews; `HomeChecklistItem` steps with weights; `gatePayment` exists for client money | Missing (Hauspire lacks it too) | Payment parts on a job (e.g. 30/50/20), each tied to a tracker step; a part becomes **due** when its step is ticked (with photo); PM proposes, accounts pays | Must |
| Advances | None (Hauspire: any early payment) | Missing | A part can be marked "advance" (before the work starts); the balance shows it as advance and recovered against later parts | Must |
| Attendance | `HomeSiteLogCrew` per daily site log (who was on site, arrival time) | Partly (Hauspire has none) | Link a crew member to a vendor/job; days-on-site per job from site logs; for day-rate crews, days × rate | Should |
| Approvals (pay) | None in either | Missing | PM (or supervisor) marks a part "work done, OK to pay"; accounts records the payment; the owner approves above a limit (setting) | Must |
| Record payment: amount, date, mode, note, reference; no overpay; full/half quick buttons | `StudioVendorPayment` + `canPay` | Have (on the old model) | Move to the job contract on `HomeProject`; keep the no-overpay rule (allow a deliberate advance via a part); record the **person**, not a shared role | Must |
| TDS deducted (gross / TDS / net) | None | Missing (unused columns in Hauspire) | Store gross, TDS and net per payment; TDS % per crew (e.g. 194C 1%/2% when PAN is given); off by default | Should |
| GST on a crew bill | None | Missing | Only with a vendor bill: taxable + GST % + total | Later |
| Retention (held until handover) and penalties/deductions (damage, delay, material wasted) | None | Missing (unused column in Hauspire) | Retention % per job, released at handover; a deduction line with reason (negative amount) shown on the statement | Should |
| Vendor's own bill/invoice upload | None | Missing (none in Hauspire) | Optional bill file and number on a part; flag a difference against the job | Later |
| Payment ledger per vendor; payments page across all; "Total released" by mode | `myVendors` most-owed first; `totalOwed` | Partly | Payables: owed by crew across projects; a ledger page with filters (date, crew, project, mode) | Must |
| Printable statement of account (lines by room, billed, extras, paid, balance; PAN, masked Aadhaar) | None | Missing | A statement PDF/print per job and per crew; share on WhatsApp from the PM's phone | Should |
| CSV export for the accountant | `csv.ts` exists for leads | Missing | Export payments and payables as CSV | Should |
| Overview worklist: Pay these (largest first), Price these, Outstanding / Extras / To price | Studio Today page and morning email (Phase 1) | Missing for crews | Today: "Parts due to pay", "Lines to price", Outstanding to crews, Extras | Must |
| Change crew on a job (refused once paid; no re-pricing) | None | Missing | Same rule | Should |
| Remove a job (refused once paid); archive instead of delete | `isActive` on vendor | Partly | The same guards; archive crews and jobs | Must |
| Quote revision diff (first vs final) to stop paying for dropped work | Revision compare exists (Phase 1) | Have | Build jobs from the final only; show "changed since the job was raised" if the design final moves | Should |
| Roles: designer runs projects, admin moves money; DB-level guard on rates | `vendor.rates` owner-only; ACCOUNTS role; PM per project | Partly | Owner: rates and margins. PM: raise jobs, measurements, extras, OK parts on own projects. Accounts: pay, see payee details. Supervisor: attendance, step ticks only (no money). Designer/Sales: nothing | Must |
| Ratings / quality checks | None in either | Missing | A crew rating after each job (quality, time, cleanliness) plus snags linked to the crew (`HomeSnag`) | Later |
| Site allocation / crew calendar | `StudioCrewMember`, site logs | Partly | Who is on which job (from jobs); a calendar later | Later |
| Notifications / WhatsApp to crews | WhatsApp is the PM's own phone (owner decision) | Missing | "Send on WhatsApp" opens the PM's WhatsApp with the job summary or statement; we send nothing | Should |
| Vendor-facing portal | None in either | Missing | Optional no-login link per job (view job, parts, statement) | Later |
| Settings: due days, TDS rate, payment modes | Studio settings exist | Partly | Default TDS %, retention %, approval limit, payment modes | Should |
| Background jobs | Crons exist (bin-purge, today-email) | Have | Add parts due and unpaid balances to the morning email | Should |

**One conflict to settle.** Hauspire's vendor app assumes **modular carpentry is
installation only at ₹150/sqft**, because "the factory makes the units and
Hauspire buys the material". That contradicts the owner's latest note (no
factory; vendors are site crews). If carpenters now build the modular units on
site, the ₹150/sqft rate and the MO-01 → "Modular Installation" resolver are
wrong. The real carpentry rate (per sqft of what? carcass + shutter? per unit?)
must be confirmed before any routing is ported. The draft
`docs/studio-os/PHASE-3-EXECUTION.md` (sections 4 Factory jobs and 3 purchase
orders) also predates this note and should be cut down to crews and jobs.

---

## 6. The core workflow in ten lines: PM and accounts with a carpenter

1. Owner/admin adds the carpenter as a vendor: name and trade (temporary). They
   are made **permanent** with phone, PAN and Aadhaar (last 4 stored) and the
   scans once they are used regularly. Their rate card is copied from the trade
   template and edited (e.g. Modular ₹150/sqft, Manual ₹250/sqft, Customised =
   blank).
2. The designer/PM imports the **final quotation** (workbook, issued PDF, 3D
   design). Lines are routed to trades; the carpentry lines go to the carpenter
   and are priced as **W×H sqft × the card rate**.
3. The PM unticks lines that are not his, fixes "trade guessed" lines, sets the
   rate actually agreed for this flat ("rate edited"; the card is untouched) and
   a due date, then creates the project. One work order exists per carpenter per
   flat, with every line snapshotted.
4. Lump-sum lines (customised work, mirror with no size) land in **Price these**.
   The PM enters a quantity, and the admin enters an agreed amount.
5. During execution the PM opens **Update quantities** and types the measured
   quantities (source site). The bill recalculates, and anything above the quote
   shows as **variance**, "approve before releasing the next payment".
6. Work agreed on site beyond the quote is added as **Add extra work** (rate ×
   qty or lump sum, no client value), so it shows separately as extras on the
   work order, project and Overview.
7. Accounts/admin opens **Overview → Pay these** (largest balance first), clicks
   **Pay**, and records an amount (Full / Half / ₹25,000 or typed), date, mode
   (Bank/UPI/Cash/Cheque) and note ("Running bill").
8. The server refuses anything above the outstanding balance. Payments are any
   amount, any day: there are no milestones, no approval step, and no TDS or
   retention.
9. When the carpenter asks what he is owed, the PM prints **Create bill**, the
   statement of account (lines by room, billed, extras, paid, balance due, PAN
   and masked Aadhaar), and they check it against his own notes or invoice.
10. When the balance is ≤ ₹1 the work order shows **Settled** and folds away.
    Every rupee stays in **Payments** (the audit trail) and on the carpenter's
    vendor page, and the project is archived (never deleted) once done.
