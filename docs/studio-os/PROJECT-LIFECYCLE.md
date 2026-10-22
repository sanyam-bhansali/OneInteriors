# The project lifecycle (owner, 13 Oct 2026; as built)

Design → Execution → Project closure → Snags → Warranty → Closed. The designer's
dashboard splits their projects into **My Design**, **My Execution** and **My Snags**.

## Phases and what moves them

`HomeProject.phase` (`ProjectPhase`), moved only by `project/lifecycle-rules.ts movePhase`
through `project/lifecycle.ts applyPhaseEvent`, inside the transaction that records the event:

| Event | Where | Move |
|---|---|---|
| Design sign-off (the existing "close design", Design Final sent) | `studio-design/design-flow.ts closeDesign` (`design.close`) | DESIGN → EXECUTION |
| The **Provisional handover** step ticked (photo + sentence) | `stage-settle.ts settleStageAfterTicks` → `syncProvisionalHandover` (every tick path) | DESIGN/EXECUTION → CLOSURE, `provisionalHandoverAt` |
| …unticked (owner/PM correction) before the closure is fixed | same | CLOSURE → EXECUTION |
| Project closure fixed ("Close the project") | `project/closure.ts saveClosure` (`project.closure`) | CLOSURE → SNAGS, `closedOutAt` |
| Client signs off the handover, no open snag | `snag-flow.ts signOffHandover`, `POST /api/app/v1/project/:id/handover` | SNAGS → WARRANTY, `handoverSignedAt`, `warrantyEndsOn` |
| Past `warrantyEndsOn` | read, never written (`effectivePhase`) | WARRANTY → CLOSED |

The last execution step is now **Provisional handover** (Hauspire's "Handover", renamed;
same 2% weight, so every project still sums to 100%). A studio that renamed it keeps working:
the stage's last in-scope step is read instead (`provisionalStepOf`).

## Project closure

`HomeProjectClosure` + `HomeProjectClosureLine`, **append-only** (every save a new version; the
final one fixes the payment). Contract (design final total once signed off, else the signed
total) + changes agreed on decisions + extra work − deductions/credits + GST on the net at the
quotation's rate (a net credit carries its GST back) − recorded payments = final amount due
(`closureTotals`). Project tab **Closure** (from the provisional handover on, for those who see money).

**Accounts handoff — TO BE SPECIFIED by the owner.** For now closing writes one
`HomeQuoteChange` "Project closure: final account" on the last payment stage, so the ledger's
balance is the final amount due; the payments desk shows "Final payment from closure: ₹X" and
accounts records it with the existing payment recording.

## Roles (owner's decisions)

- Designers see money everywhere on the projects they design: `payment.read`, quotation money,
  closure, `workorder.read` + `workorder.money` (read only). `workorder.money` now needs the
  assignment (owner, accounts studio-wide: unchanged; PM never).
- Designer and supervisor both tick execution steps (`checklist.tick` + `update.post`).
- `design.close` and `project.closure`: owner; PM and designer on the project.
- Warranty months: `Studio.warrantyMonths` (default 12), Settings → Warranty (owner, `payments.template`).

## Customer

`portal/lifecycle-view.ts customerLifecycle` (pure): phase, current step, next step, the
blocker (pay ₹x, confirm a payment, answer a drawing, your step, choose, confirm a fixed snag,
sign off your handover) or "Nothing needed from you" with what the studio is doing; warranty
end; `canSignOff`. Only starred step names cross. Words: `modules/app/lifecycle-words.ts`
(en/hi/mr) = `mobile/src/lib/strings/lifecycle.ts`. Website `app/app/project/LifecycleCard.tsx`;
Expo `mobile/src/components/project/lifecycle.tsx`. A snag raised during the warranty is a
warranty snag (`HomeSnag.warranty`); after the warranty, raising is refused.

## Snag window (owner, 15 Oct 2026)

`project/snag-window.ts` (pure) + `snag-window-store.ts`. The window **opens** the day the
handover (last) payment stage is recorded in full (counted or waiting for the client's yes),
never before the closure is fixed (`closedOutAt`); a closure with nothing left to pay opens it
on the closure day. It runs `Studio.snagWindowDays` days (Settings → Warranty, default 30).
Before it opens, and inside it, the client raises snags as before; after it, `raiseSnagAsCustomer`
refuses ("Your snag window closed on …; sign off the handover, then raise a warranty snag")
until the handover sign-off starts the warranty (warranty snags, unchanged). The client app
shows "You can raise snags here until …" (`lifecycle.snagWindowEndsOn`, `canRaiseSnag`); the
studio project header shows the same chip in CLOSURE/SNAGS. Migration
`20261015120000_my_work_reminders` (one column).

## My work and reminders (owner, 15 Oct 2026)

`studio/my-work-rules.ts` (pure) + `studio/my-work.ts`: Today / Next 3 days / Missed on every
role's home (`app/studio/home/MyWork.tsx`) and site mode. Morning digest from
`/api/cron/today-email` (08:00 IST, in-app + email); evening "due tomorrow" and "done by someone
else" from the 18:00 run of `/api/cron/site-reminders` (in-app). No new cron entries.

## Migration

`prisma/migrations/20261013120000_project_lifecycle` — expand only; RLS on the two new tables;
backfills the step rename and every project's phase. Not applied to production.

Tests: `project-lifecycle`, `project-lifecycle-card`, `customer-lifecycle`, the lifecycle block of
`customer-projection` (no leak), `studio-roles` / `studio-design-roles` / `studio-crews-rules`.

## Change orders and client sign-off (owner, 15 Oct 2026; as built)

**Extra work after design sign-off** (`project/change-order-rules.ts` pure, `project/change-orders.ts`).
Project tab **Extra work** (owner; PM and designer on the project: `extras.write`): product-master
lines sized like the quotation builder (W×H mm, sq ft, rft, each; the rate is always the master's,
re-read on the server) or custom lines with an amount; a reason; an optional photo/drawing (filed in
the locker, shared when sent). Priced the quotation's way: its modular discount, then GST at its
rate; **no professional fee** (open question). DRAFT → SENT_TO_CLIENT → APPROVED | DECLINED (reason
required) → PAID → RELEASED; a draft or an unanswered one can be CANCELLED. Every move is a
`HomeChangeOrderEvent` (append-only) + a project event. Approving writes one `HomeQuoteChange`
(`changeOrderId`) on the final stage, so the ledger, the client's payments and the closure know it
is owed; the signed lines never change. Accounts/owner (`payment.record`) record the money with the
existing recording (row carries `changeOrderId`; on the Extra work tab and the payments desk "Extra
work approved by the client, to collect"); once recorded money covers it, PAID ("ready to release").
Release refuses while a payment is disputed or short. Closure: approved change orders are read-only
rows (`changeOrdersPaise`), apart from its own typed extras (never counted twice). Quotation print:
"Extras after sign-off" section. My Execution: per-card counts and "N ready to release". Client:
website `app/app/project/ExtrasCard.tsx`, Expo `mobile/src/components/project/extras.tsx`,
`POST /api/app/v1/extras/:id`; blockers `approve_extra`, `pay_extra`. Notices: `extra-work` (client,
push else email), `extra-answered` (studio).

**Client digital sign-off** (`project/signoff-rules.ts`, `signoff-hash.ts`, `project/signoffs.ts`).
The studio asks (`signoff.request`, side card "Client sign-off") for the sales final (its marked
revision) or the design final (its newest sent revision); optional, withdrawable. The client reads
it at `/app/signoff/:id` (the quotation document itself; the Expo app opens the same page in its
web view), ticks "I have read and agree", types their full name, signs (`POST /api/app/v1/signoffs/:id`).
Kept: who, when, IP, user agent, SHA-256 of the revision's stored lines/terms/total + printed T&C,
checked again at signing. A signed copy is filed in the locker (`signoff:<id>`, opens that page).
A newer revision supersedes an unsigned request; a signature stays on its revision. "Signed by … on
…" on the project card, the signing page and the quotation's page. Blockers `sign_design_final`,
`sign_sales_final`. Drawing a signature on the phone is not built (typed name only).

Migration `20261015100000_change_orders_signoff` (expand only; RLS on the four new tables).
Tests: `change-orders`, `quote-signoff`, the change-order block of `customer-projection`, the
lifecycle blocks of `customer-lifecycle`, `studio-roles` (two new actions).
