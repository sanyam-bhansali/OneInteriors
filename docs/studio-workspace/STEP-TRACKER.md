# Step tracker — the plan as execution steps with weights

**Owner's decision, 11 Oct 2026.** Source: Hauspire's own execution tracker
(the Sandeep Dutta project sheet). It replaces the room-by-room checklist
generated from quote lines.

## The rules

1. A project's plan is a list of **steps** (granular tasks) inside the five
   stages. Every step is a checkbox.
2. **Ticking a step needs a photo and a sentence of what was done.** The
   photo and the sentence go into the **site log** for that day, with the
   date and time, labelled with the step ("Done: POP framing"). The
   customer sees them in the Site feed after the supervisor previews them.
3. **Every step holds a percentage.** The tracker shows only the percentage
   going up (overall, and per stage) and which steps are ticked with their
   day. No photos on the tracker; they live in the site log.
4. Every new project starts from **Hauspire's steps and default weights**
   (below). The studio (owner or PM, `plan.edit`) can rename a step, add a
   step, remove an unticked step, change a weight, and mark a step **not in
   scope** (or back in scope).
5. Weights: stored in basis points (10 000 = 100%). A not-in-scope step's
   weight is shared across the in-scope steps in proportion, so progress is
   `sum(done in-scope weights) / sum(in-scope weights)`, always reaching
   exactly 100% when every in-scope step is ticked. The office editor shows
   the effective % of each step and the total.
6. The quote's lines are still the **materials list** (locker). They are no
   longer ticked.
7. A stage shows done when every in-scope step in it is ticked (its photo
   gate is met automatically, since every tick carries a photo). Unticking
   (owner/PM only, a correction) reopens the stage; the photo stays in the
   site log (append-only).

## Default steps (Hauspire), with weights in %

Stages keep their kinds. The sheet's sections become step **groups** inside
a stage (stored in the existing `room` column, read as "group").

| Stage (kind) | Group | Step | % |
|---|---|---|---|
| Design (DESIGN) | Design | Final design and drawings signed off | 2 |
| POP, civil and electricals (CIVIL) | Execution stage 1 | POP, civil, fabrication and electrical work started | 1 |
| | | POP framing | 4 |
| | | POP wiring | 3 |
| | | POP sheets | 4 |
| | | POP lights | 2 |
| | | PVC POP work | 2 |
| | | Fabrication work | 3 |
| | | Civil work | 4 |
| Carpentry (CARPENTRY) | Execution stage 2A | Site inspection of POP and civil work by the designer | 1 |
| | | Material at site: moulding, safety-door jali, ply | 2 |
| | | Site discussion and carpentry started | 1 |
| | | Materials delivered from the factory | 3 |
| | | Hardware stage 1 ordered (tandems, channels, folding mechanisms) | 1 |
| | | CNC work and PU material ordered | 1 |
| | | Carcass complete with hardware | 10 |
| | | Shutters measured and ordered | 1 |
| | | Hardware stage 2 ordered (hinges, handles, push magnets, hydraulics) | 1 |
| | | Handles, knobs and locks ordered | 1 |
| | | Site inspection at carcass stage by the designer | 1 |
| | Execution stage 2B | Name plate ordered | 0.5 |
| | | Temple acrylic and small items ordered | 0.5 |
| | | Manual carpentry work complete | 6 |
| | | Painting putty started | 2 |
| | | Shutters delivered | 4 |
| | | Hardware stage 2 delivered | 1 |
| | | Profile door, mirror, headboard and wallpaper ordered | 1 |
| | | Handles and locks installed | 3 |
| | | Site inspection at shutter stage by the designer | 1 |
| | | Safety door installed | 2 |
| | | Carpentry complete and site cleaned | 3 |
| Finishing (FINISH) | Finishing | Profile door and mirror installed | 3 |
| | | Painting started | 2 |
| | | Painting complete | 8 |
| | | Cleaning started | 1 |
| | | Cleaning complete | 2 |
| | | Name plate installed | 1 |
| Handover (HANDOVER) | Handover preparation | Headboard and wallpaper installed | 3 |
| | | Snags listed | 1 |
| | | Snag list closed | 2 |
| | | Site inspection by the designer | 1 |
| | Handover | Final inspection with the client | 1 |
| | | Final snags closed | 1 |
| | | Handover | 2 |
| | | **Total** | **100** |

### Planned day of each step

Each step has a planned day (the sheet's "Expected date"). Steps are spread
across their stage's planned window by their position in the sheet: the
template keeps each step's day offset from the sheet (start 17 Jul 2026,
handover 4 Nov 2026), and a step's day is its stage's start plus its
offset's share of that section's span, scaled to the stage's length. When a
stage's dates move (`moveDate`), its steps' days move by the same number of
days. Delays and their reasons stay at stage level (`HomeProjectDateChange`),
as now; per-step revised dates are not in this change.

## Data (expand only; migration not applied to production)

- `HomeChecklistItem` becomes the step:
  - `room` holds the step's group.
  - New: `weightBp Int @default(0)`, `inScope Boolean @default(true)`,
    `plannedOn DateTime? @db.Date`, `donePhotoId String?` (the
    `HomeSiteLogPhoto` that ticked it; unique; SetNull).
  - Customer projection reads `label`, group, effective %, done, done day;
    never `doneById`.
- `HomeSiteLogPhoto` gains nothing; the step link is on the item. The site
  feed finds a photo's step through `donePhotoId`.

## Where it changes

- `portal/quote-to-plan.ts`: stages get template steps (`STEP_TEMPLATE`,
  new pure module `project/step-template.ts`) instead of quote-line items.
  Materials and payments unchanged. Tests updated.
- `project/step-rules.ts` (pure, tested): effective weights, overall and
  per-stage %, the step-date spread, validation for edits.
- Site mode post (`site-log.ts`, `site-log-rules.ts`, `PostUpdate.tsx`, the
  offline queue): a tick must name one of the post's photos (`photoIndex`)
  and that photo must carry a sentence (typed, or from its mic, previewed).
  One photo per tick. Ticks without a photo are refused (`tick_photo`).
- Office Plan tab (`plan-edit.ts`, `PlanTab.tsx`): steps grouped by stage and
  group, each with its %; ticking from the office opens "Add photo and what
  was done", which posts into today's site log (a CORRECTION if today's
  post exists) and ticks the step. Owner/PM: edit name, weight, in/out of
  scope, add, remove (unticked only), untick.
- Customer: `tracker-view.ts` and the API/mobile tracker show the overall %
  and each stage's %, steps with ticks and days, no photos. The site feed
  (`site-feed-view.ts`, website and app) labels a photo that ticked a step
  "Done: {step}" with its time.
- Existing projects: `scripts/studio/steps-from-template.ts` replaces the
  generated room items of a project with the template steps (stages already
  done get their steps ticked without a photo, `doneSource` BACKFILL);
  the owner runs it on production after the migration.
