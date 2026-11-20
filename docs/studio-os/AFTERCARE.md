# After the handover: warranty claims and service visits

Owner, 20 Nov 2026, aligned to Hauspire's Interior Design Services Agreement (clause 5,
Warranty and post-completion services). The client's portal (website `/app/aftercare`, Expo
`aftercare` screen, both through `/api/app/v1/aftercare`) has two options after the handover:
**Warranty claim** and **Service visit**. Max studios only while it is tested (Hauspire).

Code: `src/modules/aftercare/` (`rules.ts` pure and tested, `store.ts`, `reader.ts`,
`razorpay.ts`, `razorpay-sign.ts`, `coverage-ops.ts`). Tests: `tests/aftercare.test.ts`,
`tests/aftercare-flow.test.ts`, `tests/aftercare-db.integration.test.ts` (local PGlite only).

## 1. The payment gate, first, for both

Both options always show. On submit, the project must be 100% paid: the ledger's balance
(`project/payment-ledger.ts`) above zero, even ₹1, refuses with "Please clear your payments
first. ₹X is pending." (HTTP 402, `pendingPaise`). Nothing is read, stored or held before the
gate. A payment the studio recorded that the client has not confirmed is still pending (the
message says to confirm it under Payments). Backfilled and before-joining rows count as paid.
A project with no payment plan in the app is not cleared. (Agreement 5.5: no warranty or
service when the payment terms were not kept.)

## 2. Warranty claim

- Only during the warranty (phase `WARRANTY`, after the handover sign-off). Before it:
  "raise problems under Snags". After it: "raise a service request". The warranty length is
  Settings → Warranty (months); **the agreement says 10 years (120 months) for modular
  woodwork**, so set Hauspire's to 120.
- The client picks the area, says what is wrong, adds 1–4 photos.
- **Coverage is data**: `WarrantyCoverageRule` rows (key, label, examples for the photo reader,
  covered, the service visit to book instead, an optional extra line for the client). Rows with
  no studio are the default list, seeded by migration `20261120120000_aftercare` from the
  agreement:
  - Covered (5.3): manufacturing defects in the core material and workmanship of modular
    woodwork — `MODULAR_CORE` (board or build), `MODULAR_FINISH` (laminate, edge band, finish).
  - Not covered: hardware (5.2, the manufacturer's warranty; the reply says the studio helps
    claim it), small adjustments and loose screws (5.3 d), water, damp and pests (5.3 c), wear,
    fading and misuse (5.3 a, b), and work outside the modular scope (2.3): paint, electrical,
    wallpaper, plumbing, ceilings and tiles, glass, curtains and decor, appliances.
  - Ops edits them at **`/ops/warranty-rules`** (switch a rule off rather than repurpose it).
- **Photo reader**: Claude Sonnet 5.5 (`claude-sonnet-5-5`, owner's pick, about ₹2 a claim)
  names the area from the photos. The reader wins over the client's pick; if it cannot answer
  (no `ANTHROPIC_API_KEY`, error, refusal), the client's pick decides. Nobody rates by hand.
- **Covered**: a warranty snag (`HomeSnag.warranty`) with the client's photos; the office and
  the design head are told; the design head (Renuka) assigns it with a fix-by date
  (`snag.accept`, a design-head right). The client follows it under Snags.
- **Not covered**: "This is not covered under your warranty. Please raise a service request."
  plus the area's own line. Kept for the record (`WarrantyClaim`), nothing raised, nobody asked
  to answer; the app switches to Service visit.

## 3. Service visit

- Kinds of work: carpentry, painting, electrical, wallpaper, plumbing, false ceiling and tiles,
  something else. Each studio sets a fixed **visiting charge** per kind in Settings (owner); a
  kind with no charge cannot be booked.
- Slots: the first day is **today + 5**, every day of the week, seven days shown, four 2-hour
  slots (10–12, 12–2, 2–4, 4–6), `serviceSlotVisits` visits per slot (Settings, default 2).
- **One free visit** (agreement 5.1, owner 20 Nov 2026): one visit booked within **30 days of
  the handover sign-off**, only when 100% is paid (the gate runs first). Every kind is open; the
  studio's charge shows struck out beside "Free"; booked at once, no payment page. A cancelled
  free visit gives the free visit back.
- Otherwise: the slot is **held 20 minutes** while the client pays the charge on a **Razorpay
  payment link**. Paid (signed redirect `/api/pay/razorpay/service` or webhook
  `/api/pay/razorpay/webhook`, `payment_link.paid`) books it, once. An unpaid hold expires by
  itself; one unpaid hold per project. That is the only way to book.
- Booked: the office (email too), the design head and the client hear.
- **The studio** (`/studio/service-visits`, Projects → Service visits; owner, PM, design head
  act, accounts reads): **Move** to any slot from tomorrow up to 60 days; **Mark done** with a
  line; **Cancel** with a reason — a paid visit is refunded in full through Razorpay first, and
  if the refund fails nothing is cancelled. The client is told each time and sees the line.

## To switch on (owner)

1. Run migration `20261120120000_aftercare` from the `prod-migrate` worktree.
2. Vercel env (never in a file): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (test keys
   `rzp_test_…` first), `RAZORPAY_WEBHOOK_SECRET`; in Razorpay's dashboard, a webhook to
   `https://<site>/api/pay/razorpay/webhook` for `payment_link.paid` with the same secret.
   `ANTHROPIC_API_KEY` is already used by the floor-plan reader.
3. Hauspire's Settings: Warranty 120 months; Service visits, a charge per kind.

## Open with the owner

- Notice for a visit: the agreement (5.4) says 7 working days; the owner decided (20 Nov 2026)
  to keep the first slot at **today + 5**. Worth aligning the agreement's next version.
- The agreement (5.4) prices paid service case by case; built as the owner asked, a fixed
  visiting charge per kind. Extra work found on the visit is quoted as before (change orders).
- Visiting charges land in whichever Razorpay account the keys belong to; paying them on to
  the studio is outside the app.
- The Warranty Certificate on full clearance (5.7) is not generated yet.
