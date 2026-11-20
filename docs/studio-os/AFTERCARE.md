# After the handover: warranty claims and service visits

Owner, 20 Nov 2026. The client's portal (website `/app/aftercare`, Expo `aftercare` screen,
both through `/api/app/v1/aftercare`) has two options after the handover: **Warranty claim**
and **Service visit**. Max studios only while it is tested (Hauspire).

Code: `src/modules/aftercare/` (`rules.ts` pure and tested, `store.ts`, `reader.ts`,
`razorpay.ts`, `razorpay-sign.ts`). Tests: `tests/aftercare.test.ts`,
`tests/aftercare-flow.test.ts`, `tests/aftercare-db.integration.test.ts` (local PGlite only).

## 1. The payment gate, first, for both

Both options always show. On submit, the project must be 100% paid: the ledger's balance
(`project/payment-ledger.ts`) above zero, even ₹1, refuses with "Please clear your payments
first. ₹X is pending." (HTTP 402, `pendingPaise`). Nothing is read, stored or held before
the gate. A payment the studio recorded that the client has not confirmed is still pending
(the message says to confirm it under Payments). Backfilled and before-joining rows count as
paid. A project with no payment plan in the app is not cleared.

## 2. Warranty claim

- Only during the warranty (phase `WARRANTY`, after the handover sign-off). Before it:
  "raise problems under Snags". After it: "raise a service request".
- The client picks the area, says what is wrong, adds 1–4 photos.
- **Coverage is data**: `WarrantyCoverageRule` rows (key, label, examples, covered, the
  service category to send the client to). Rows with no studio are One Interiors' default
  list, seeded by migration `20261120120000_aftercare`; a studio with active rows of its own
  uses those. Default: only modular (structure, hardware, shutters and finish) is covered;
  paint, lights/electrical, wallpaper, plumbing, ceiling/tiles, glass, damage from use and
  appliances are not. Change coverage by changing rows, not code.
- **Photo reader**: Claude Sonnet 5.5 (`claude-sonnet-5-5`, owner's pick, about ₹2 a claim)
  names the area from the photos. The reader wins over the client's pick; if it cannot answer
  (no `ANTHROPIC_API_KEY`, error, refusal), the client's pick decides. Nobody rates by hand.
- **Covered**: a warranty snag (`HomeSnag.warranty`) with the client's photos, the office
  and the design head are told; the design head (Renuka) assigns it with a fix-by date
  (`snag.accept`, now a design-head right). The client follows it under Snags.
- **Not covered**: "This is not covered under your warranty. Please raise a service
  request." The claim is kept for the record (`WarrantyClaim`), nothing is raised, nobody is
  asked to answer, and the app switches to Service visit.

## 3. Service visit

- Kinds of work: carpentry, painting, electrical, wallpaper, plumbing, false ceiling and
  tiles, something else. Each studio sets a fixed **visiting charge** per kind in Settings
  (owner); a kind with no charge cannot be booked.
- Slots: the first day is **today + 5**, every day of the week, seven days shown, four
  2-hour slots (10–12, 12–2, 2–4, 4–6), `serviceSlotVisits` visits per slot (Settings,
  default 2).
- **The free month** (owner, 20 Nov 2026): for one month after the handover sign-off (same
  day next month, judged on the day the client books), a visit is free, only when 100% is
  paid (the gate runs first). Every kind is open; the studio's charge shows struck out beside
  "Free"; the visit is booked at once, no payment page.
- After the month: the client picks a slot, it is **held 20 minutes**, and they pay the
  charge on a **Razorpay payment link**. Paid (signed redirect `/api/pay/razorpay/service`
  or webhook `/api/pay/razorpay/webhook`, `payment_link.paid`) books the visit, once. An
  unpaid hold expires by itself. One unpaid hold per project. That is the only way to book.
- Booked: the office (email too), the design head and the client hear. The studio sees
  upcoming visits at `/studio/service-visits`.

## To switch on (owner)

1. Run migration `20261120120000_aftercare` from the `prod-migrate` worktree.
2. Vercel env (never in a file): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (test keys
   `rzp_test_…` first), `RAZORPAY_WEBHOOK_SECRET`; in Razorpay's dashboard, a webhook to
   `https://<site>/api/pay/razorpay/webhook` for `payment_link.paid` with the same secret.
   `ANTHROPIC_API_KEY` is already used by the floor-plan reader.
3. Settings → Service visits: Hauspire's charge per kind.

Not yet: an editor for coverage rules (ops changes rows for now); paying the visiting charge
out to the studio (it lands in the Razorpay account it is paid into); cancelling or moving a
booked visit (the studio calls the client).
