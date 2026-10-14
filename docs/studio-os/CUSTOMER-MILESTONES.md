# Customer milestones (owner, 12 Oct 2026; as built)

> "The customer side project tracker shouldn't have this much detail. Keep the
> ~5 overall stages and in each stage 2–3 milestones that every studio decides
> for itself by giving a STAR to a step; starred steps show on the customer
> side. All other steps are purely for the studio's internal management."

## What changed

**Data.** `HomeChecklistItem.customerMilestone Boolean @default(false)` — the
star. Migration `prisma/migrations/20261012170000_customer_milestones`
(expand-only: one defaulted column plus a backfill of it; no new table, so no
new RLS — `home_checklist_items` has had it since 20261011140000). **Not
applied to production.** The backfill stars existing projects' steps by stage
kind and step name, from the defaults below; a renamed or added step stays
unstarred.

**Templates (defaults, studio-editable).**
- Execution steps: `TemplateStep.milestone` in `src/modules/project/step-template.ts`
  (`TEMPLATE_MILESTONES`). Stars per project are changed on the Plan tab.
- Design steps: `DesignTemplateStep.milestone` in `src/modules/studio-design/template.ts`
  (`DESIGN_MILESTONES`), editable in **Settings → Design steps** (a "★ Client
  sees" column). A template saved before stars existed reads with Hauspire's
  stars by name.
- Signing, booking (`portal/plan-write.ts` `writePlan`), the plan and steps
  backfills and **Use our design steps** (`applyDesignSteps`) copy the flag.

**Studio side.**
- A ★ toggle on every step in the **Plan** tab and the **Design** tab
  (`StarToggle.tsx`). Owner or PM only (`plan.edit`, checked in
  `plan-edit.ts` `starStep`); others see the star, read-only. Event
  `step.starred` with `{ starred }`.
- Hint: "Starred steps are what the client sees. The rest are for your team."
- Per stage: "★ 2 shown to the client", with a soft warning (never a block)
  at 0 stars or more than 4 (`step-rules.ts` `milestoneWarning`).
- Messages on rename / scope / add / remove now say the customer sees the
  step only when it is starred.
- **What {client} sees right now** (project page) shows the stage under way,
  its %, and its starred milestones — the same projection the app reads.

**Customer side.** Stages (name, status, % done, planned end) and under each
only the starred milestones (name, done ✓ with the day, or the planned day).
- Website `/app/project`: milestones under every stage (no full step list,
  no "n of 44 steps"). Design card: % done, milestones, "Next", the payment
  the design waits on, "Waiting on you" for the client's own step, mood board,
  drawings to approve.
- Phone app: the current stage shows its milestones with the bar; other
  stages list their milestones; the design card adds the payment and "Waiting
  on you". Strings in en/hi/mr (`project.steps.title` → "Milestones in this
  stage", `design.steps`, new `design.yourTurn`). Sample data shows starred
  steps only.
- Percentages (project, stage, design) are unchanged: they count **every**
  in-scope step.
- The site feed's "Done: {step}" under a photo, and the post's `done` list,
  name a step only when it is starred. The photo and its sentence still show.

## Defaults (Hauspire)

| Stage | Starred steps |
| --- | --- |
| Design (design steps) | Site visit and measurement · First 3D and renders · Design closure |
| Design (plan made before design steps) | Final design and drawings signed off |
| POP, civil and electricals | POP, civil, fabrication and electrical work started · POP sheets |
| Carpentry | Materials delivered from the factory · Carcass complete with hardware · Shutters delivered |
| Finishing | Painting started · Painting complete |
| Handover | Snags listed · Handover |

## API (backward compatible)

`GET /api/app/v1/project` keeps every field and shape. **`steps` arrays now
carry only milestones** (no separate `milestones` field): `tracker.stages[].steps`,
`tracker.current.rooms`, `tracker.stages[].checklist` (counts milestones),
`design.steps`. New on `design`: `waitingFor` and `yourStep`. `doneStep` on a
site photo is null for an unstarred step. Details in docs/APP-API-JOURNEY.md
§ Customer milestones.

## Tests

- `tests/customer-milestones.test.ts`: defaults per stage, the migration's
  backfill matches the templates name for name, old design templates get
  stars by name, plans copy the stars, the soft warning.
- `tests/customer-projection.test.ts` (the no-leak test): an unstarred step's
  name, day or count never reaches the tracker, the current checklist, the
  design card or the site feed; percentages still count it.

## Open

- After applying the migration, studios with renamed steps should check their
  stars on running projects (the backfill matches names only).
