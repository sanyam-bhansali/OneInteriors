# Studio OS — Phase 2 built: Design, from booking to design final

**Built:** 12 Oct 2026, against [PHASE-2-DESIGN.md](PHASE-2-DESIGN.md).
**Migration:** `prisma/migrations/20261012140000_studio_design_phase2` — expand only, **not applied** anywhere.
**Rule kept everywhere:** easy, not automatic. Nothing ticks or chases by itself; the only
automatic things are the client's one notice when something is shared with them (push, else
email, never WhatsApp) and the DESIGN stage showing done when its last in-scope step is ticked.

## What was built, and where

| Spec | Where |
|---|---|
| DESIGNER role | `studio/roles.ts` (`design.work`, `design.assign`, `design.template`, `design.workload`; DESIGNER = `project.read`, `document.upload`, `design.work`, all assigned-only), `surfaces.ts` (home `/studio/design`; opens only that and `/studio/projects/<id>`), `team-rules.ts`, `team-store.ts`, `app/studio/RoleFrame.tsx` ("My design work" link) |
| Designer on the project | `HomeProject.designerId`; `studio-design/design-flow.ts assignDesigner` (owner/PM on the project) writes the team row so `access.ts` lets them in, and removes a replaced designer's row. Picked on the Design tab — `studio-sales/booking.ts` untouched |
| Design steps | `studio-design/template.ts` (Hauspire's 19, gates, documents, 2 BHK gaps, BHK days 14/24/27/29, designer-days), `rules.ts` (linked days, weights, gate matching, `gateOf`, `checkDesignTick`, `planStepMove`). Built into the DESIGN stage by `portal/quote-to-plan.ts` (`designStepsFor`, `stageDates(…, designDays)`), written by `plan-write.ts`; `own-project.ts` and `choose.ts` pass the studio's template and the flat size (`studio-design/plan-input.ts`) |
| Tick / move / edit / apply | `design-flow.ts tickDesignStep` (gate + file; file filed in the locker as a team draft unless "show the client"), `moveDesignStep` (linked; `HomeStepDelay` history), `editDesignStep` (who, file, gate), `applyDesignSteps` (older projects). Design steps count as the DESIGN stage's evidence in `project/stage-settle.ts`; site mode cannot tick them (`site-log.ts`); the Plan tab points to the Design tab for them; `untickStep` lets go of the note and file |
| Settings → Design steps | `app/studio/settings/design/*` (owner), `Studio.designTemplate` |
| Mood board | `shareMoodBoard`, `addMoodBoardPieces` (writes the client's `PrepRoom`, seeding an untouched room first); the tab shows `prepare/prep.ts prepForBrief` |
| Site visit, measurements | `HomeSiteVisit`, `HomeMeasurement`; `bookVisit`, `setVisitStatus`, `saveMeasurements` (feet in, mm stored: `rules.ts parseLength/formatLength`) |
| Drawings and 3D | `HomeDocument.designKind/room` + locker versions; `uploadDrawing`, `shareDrawing`; client answers `answerDrawing` (owner of the brief only, newest version only, comment required for changes) → `HomeDesignReview`; API `POST /api/app/v1/design/:id/answer`; reminder line for the designer's own WhatsApp after 3 days |
| Design final | `makeDesignFinal` calls `studio-quote/quotes.ts copyQuote` (unchanged); `closeDesign` (Design Final must be sent) freezes `compareToIssued` + totals into `HomeProject.designChanges` |
| Studio UI | `app/studio/projects/[id]/DesignTab.tsx`, `DesignPanel.tsx`, `design-actions.ts`; tab "Design" on the project (a designer opens on it); reads `studio-design/store.ts designForStudio` |
| Designers' page | `app/studio/design/page.tsx`, `store.ts designWorkload` (owner/PM: every designer + "No designer yet", load vs 25 days; designer: own projects). Nav: "Design" under Projects (`app/studio/layout.tsx`, one line) |
| Customer | Projection `design` (`studio-design/customer-view.ts`, spread into `portal/customer-project-view.ts`); website `app/app/project/DesignCard.tsx`; phone app `mobile/src/components/project/design.tsx`, `lib/strings/design.ts` (en/hi/mr), `lib/types.ts`, `lib/api.ts answerDrawing`, sample data |
| Notices | `notify/messages.ts` kind `design` (to `/app/project`) |
| Events | `project/events.ts`: `designer.assigned`, `design.ticked`, `design.step_moved`, `design.step_edited`, `design.steps_applied`, `design.shared`, `design.answered`, `design.closed`, `moodboard.shared`, `moodboard.edited`, `visit.booked`, `visit.updated`, `measurements.saved` |

Tests added: `tests/studio-design-{template,rules,roles}.test.ts`; the no-leak block in
`tests/customer-projection.test.ts`. Updated: `studio-roles` (DESIGNER column, four actions),
`quote-to-plan` and `plan-signing` (DESIGN stage now holds the design steps), `app-geio` fixture.

## Decisions the plan did not settle

1. **Weights.** Design steps share the DESIGN stage's existing 200 bp (2%), so execution
   weights and every existing percentage test stay as they were. The Design tab and the client
   read the **design %** (the stage's progress), which is what moves during design.
2. **Gates are words, matched at build time** ("design advance" → the project's payment stage
   whose label contains it), because each project's stages are its sales final's. No match =
   no gate. Open = the stage is `paid` or `waiting` (recorded, customer not yet confirmed).
3. **Linked dates move forward only by hand.** "Running late" moves the step and every open
   step after it; the plan's stage dates are not moved — the tab says how far past the plan
   design ends and links to the Plan tab's "Move a date".
4. **Design steps never tick from site mode**; their evidence for "stage done" is the tick
   itself (a backfilled tick does not count).
5. **The designer can be the owner or a PM** too (the picker lists active designers, PMs and
   owners). Only a replaced DESIGNER loses the team row; a PM keeps theirs.
6. **Close design needs the Design Final sent** (not a draft), so the frozen comparison is
   what the client was shown.
7. Older projects keep their one design step until owner/PM presses "Use our design steps"
   (refused once any design step is ticked).

## Setup Sanyam does

- Apply the migration to the local test DB, then production when ready.
- Invite designers from Settings → Team with the new **Designer** role, then pick one on each
  project's Design tab.

## Left undone / known limits

- No dev server or database was used (by instruction): not walked through in a browser.
- The designer gets no notice when the client answers a drawing; it shows on the Design tab
  and the designers' page.
- The "← Projects" link on a project sends a designer back to their design page (the layout
  redirect), not a list.
- Re-planning design dates when the flat size changes after booking is not built (the plan
  says so).
- `tests/studio-sales-roles.test.ts` failed during the build on another agent's in-progress
  `lead.claim` action; it passed in the final run.
