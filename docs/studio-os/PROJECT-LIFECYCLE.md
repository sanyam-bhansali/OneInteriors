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

## Migration

`prisma/migrations/20261013120000_project_lifecycle` — expand only; RLS on the two new tables;
backfills the step rename and every project's phase. Not applied to production.

Tests: `project-lifecycle`, `project-lifecycle-card`, `customer-lifecycle`, the lifecycle block of
`customer-projection` (no leak), `studio-roles` / `studio-design-roles` / `studio-crews-rules`.
