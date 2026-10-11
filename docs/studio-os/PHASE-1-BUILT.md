# Studio OS — Phase 1 built: Sales, from lead to booked

**Built:** 12 Oct 2026, against [PHASE-1-SALES.md](PHASE-1-SALES.md) (owner-approved).
**Migration:** `prisma/migrations/20261012100000_studio_sales_phase1` — expand only, **not applied** anywhere.
**Rule kept everywhere:** easy, not automatic. The only thing that moves a lead by itself is
recording the booking (to the first WON column) and refunding it (back to where it was).

## What was built, and where

| Spec | Where |
|---|---|
| SALES role, per-action lead rights | `src/modules/studio/roles.ts` (`lead.*`, `quote.write`, `quote.salesFinal`, `booking.record`, `booking.refund`, `payments.template`; `leadsVisibleTo`, `quotesVisibleTo`), `surfaces.ts` (what SALES may open, Today as home), `team-rules.ts` (role card), `lead-scope.ts` (the scope every lead / quote read starts from) |
| Today (new landing for owner, PM, sales) | `src/app/studio/today/*`, rules `src/modules/studio-sales/today-rules.ts`, reads `today.ts`; nav "Today" at the top (`app/studio/layout.tsx`), a salesperson's rail is Today · My leads · Quotations |
| Morning email | `today.ts sendTodayEmails`, cron `src/app/api/cron/today-email` |
| Lead page | `src/app/studio/clients/[id]/page.tsx` + `SalesPanels.tsx`; reads/writes `src/modules/studio-sales/leads.ts`, rules `lead-rules.ts` |
| Lead files (floor plan) | upload ticket `src/app/api/studio/leads/upload`, storage `src/modules/storage/lead-files.ts`, model `StudioClientFile`; optional "Read rooms" (`leads.ts readRoomsOn`) feeds the next quotation's rooms (`studio-quote/quotes.ts planReadingOf`) |
| New quotation from the lead / pick or create a lead on the new-quotation screen | `leads.ts newQuoteForLead`, `app/studio/quotations/NewQuote.tsx` + `actions.ts`; `createQuote({ clientId })` writes a `QUOTED` timeline line |
| Revisions R1, R2…, compare any two | `StudioQuoteRevision`; `src/modules/studio-sales/revisions.ts` (`issueRevision` on every send, `sendAgain`), `revision-rules.ts`; panel `app/studio/quotations/[id]/Revisions.tsx`; compare `…/compare?a=1&b=3` |
| Sales final + its payment stages | `revisions.ts markSalesFinal` (`StudioQuote.salesFinalRevisionId/Schedule/At/ById`), editor `app/studio/PaymentStagesEditor.tsx` |
| Payment stages template | `src/modules/studio-sales/payment-template.ts` (Hauspire's six by default), `settings.ts`, page Settings → Payment stages (`/studio/settings/payments`, owner) |
| Record booking / refund | `src/modules/studio-sales/booking.ts` + `booking-rules.ts`; reuses `project/own-project.ts startOwnProject` (new `opts`), on the lead page and on accounts' desk (`app/studio/payments/Bookings.tsx`) |
| Sources: Facebook + studio's own | `ClientSource.FACEBOOK`, `StudioLeadSource`, Settings → Lead sources; shown on the board, lead, filters, import, analytics |
| Import asks the source, maps custom fields | `app/studio/clients/import/*`, `csv.ts planImport` (`custom:<key>` columns), `clients.ts importClients` |
| Website form duplicate check + notify | `studio-practice/capture.ts` (+ `intake-rules.ts formLanding`); `notify/messages.ts` `lead-new`, `lead-assigned` |
| Assign one or many, salesperson told | lead page, Today (one and "all"), board ("Give the N shown to…"); `clients.ts assignClients` notifies (inbox + email) |
| Audit fixes | bin purge `studio-sales/bin-purge.ts` + cron `api/cron/bin-purge`; sample excluded from "waiting on you" (`clients/page.tsx`, `studio/page.tsx`); board search + filters (name/phone, source, column; owner = "Showing"); card and search results link to the lead page |

Tests added: `tests/studio-sales-{template,revisions,booking,roles,intake,today,lead}.test.ts`.
Tests updated for the new role: `studio-roles`, `studio-surfaces`, `studio-team` (accounts now also
records/refunds bookings; owner and PM land on `/studio/today`).

## Decisions the spec did not settle

1. **How SALES is fenced.** SALES is *not* an office role: `myStudioId()` still finds no studio
   for them, so every older office module (settings, products editing, projects, vendors,
   analytics, pool, bin, import, merge) stays closed by default. The screens they do use read
   through `studio/lead-scope.ts`, which adds `assignedToId = me` to every lead query and
   `client.assignedToId = me` to every quotation query. Read-only things quoting needs
   (product list, branding, tier, rates gate, studio profile for the PDF) use
   `quotingStudioId()`.
2. **A lead a salesperson adds by hand is theirs**, not the pool's — in the pool they could not
   see it. Owner/PM-added, imported, form and One Interiors leads still land in the pool.
3. **Own source names**: FK `StudioClient.leadSourceId → StudioLeadSource` with `source = OTHER`
   (not free text in `sourceNote`, which import already uses). Analytics groups by both, so a
   studio's name counts as itself.
4. **Booking chain**: stored in a new `StudioClient.bookedIntroductionId` (+ `bookedAt`,
   `preBookingStageId`), not `introductionId`, which means "introduced by One Interiors"
   everywhere it is read.
5. **Booking is refused when the quotation changed after its sales final** (lines or total). The
   project is built from the quotation as it is; the person sends the new version and marks it,
   or undoes the change. The contract and stages come from the sales final revision.
6. **"Sent" = Mark as sent / "Send this version as R(n+1)".** Printing a PDF does not make a
   revision (the existing rule: a draft printed to read is not sent). Sending identical content
   twice does not make a new number.
7. **Refund**: correction row (amount 0, `correctsId`) on the booking payment; project gets
   `cancelledAt` / `cancelReason` and lets go of `signedQuoteId` (unique) so the quotation is
   free again; invites revoked; quotation back to Sent; lead back to its earlier column (or the
   intake column). Cancelled projects are left out of the customer's app (`customerProjects`,
   plan reads), reminders, the projects list and the payments desk. Within the refund days
   (first stage's `refundDays`, 3 by default): accounts, owner, PM; later: owner only, after an
   explicit "Refund anyway".
8. **Where accounts records bookings**: accounts never opens leads, so `/studio/payments` lists
   sales finals waiting for the advance (same form as the lead page) and the last two weeks'
   bookings with Refund.
9. **Payment stages live in Settings → Payment stages** until the Library exists. Percentages may
   have two decimals; at least one stage must be a percent; the first stage is the one paid to
   book. The project's `paymentPhases` get the rupee amounts (pct null), which
   `paymentSchedule` keeps exact.
10. **Lead files bucket** is new: `lead-files` (see below). Upload goes browser → signed URL →
    Supabase, so 15 MB works despite the 4 MB action limit; the attach step checks the path
    belongs to the lead and that the object exists.
11. `StudioQuoteRevision` is append-only (`project/append-only.ts`); new timeline kinds EDITED,
    FILE, MEETING, SALES_FINAL, BOOKED, REFUNDED; new project event `project.cancelled`.

## Crons added (vercel.json)

| Path | Schedule (UTC) | IST |
|---|---|---|
| `/api/cron/bin-purge` | `30 21 * * *` | 03:00 daily |
| `/api/cron/today-email` | `30 2 * * *` | 08:00 daily |

That makes five cron jobs (site-reminders already runs twice a day). Vercel Hobby allows only
daily jobs and a small number of them; this needs the Pro plan (as site-reminders already
does). Both need `CRON_SECRET` set; without it they do nothing.

## Setup Sanyam does

- Apply the migration to the local test DB, then production when ready.
- Supabase → Storage → new bucket **`lead-files`**: Private, 15 MB limit, MIME types
  `application/pdf, image/jpeg, image/png, image/webp, image/heic`, no anon/authenticated
  policies. Without storage keys in development, uploads are skipped (`dev-unstored/`).
- Invite salespeople from Settings → Team with the new **Sales** role.

## Left undone / known limits

- **Rebooking a refunded client** through the booking flow is refused ("already has a project
  with your studio") because the cancelled project keeps its introduction. Rare; a later phase
  can reuse the introduction.
- The Today email goes only to people with an email address (most phone-only staff have none);
  WhatsApp delivery waits for the studio template, as the spec says.
- Saved views and the "Showing" member filter stay owner/PM tools; a salesperson's board has
  search, source and column filters only.
- No browser walkthrough was run here (no dev server, no database by instruction); everything
  is checked by `tsc`, lint and the test suite.
- The One Interiors brief panel and duplicate-merge panel are not shown to a salesperson
  (those modules stay office-only).
