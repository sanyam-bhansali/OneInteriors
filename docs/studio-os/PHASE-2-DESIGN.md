# Studio OS — Phase 2: Design, from booking to design final

**For:** Sanyam's go-ahead · **Written:** 12 Oct 2026 · **Follows:** [PHASE-1-SALES.md](PHASE-1-SALES.md)

Rule for everything below (owner, 12 Oct): **easy, not automatic.** The software
records what the designer, the PM and the client decide. Nothing ticks itself,
nothing chases the client by itself; a client hears from us only when something
is shared with them (app push, else email, never WhatsApp). Studio staff may
use their own WhatsApp; we only open it for them.

## Hauspire's design process (what Phase 2 must fit)

1. **Booking advance ₹25,000** (Phase 1) → the project exists → owner or PM
   **assigns the designer**; the client already has the app.
2. Site visit and measurement → mood board → 2D layout and furniture layout.
3. **Design advance 5%** opens the first draft (FD) meeting → design changes,
   material selection, first 3D and renders → design closure → final (design)
   quotation.
4. **Design closure 10%** opens the technical work: BOQ, site visit with the
   carpenter and electrician, working drawings (false ceiling, factory),
   manual vs factory split, electrical drawing, final documentation →
   agreement → handover to execution (Phase 3).

Each payment is paid at the **start** of its stage: it is a gate. Target days
from allocation to material procurement: 1 BHK 14, 2 BHK 24, 3 BHK 27,
4 BHK 29; each step's planned day is the previous step's plus N days.

## What gets built

### 1. A Designer on the team and on the project
- New role **DESIGNER**. Sees only the projects they are the designer on: the
  plan, site log, snags, decisions as the client sees them, the locker, and a
  new **Design** tab. No payments tab, no amounts, no studio costs, no other
  designers' projects, no leads. Lands on **My design work** (`/studio/design`).
- **Designer** on the project: owner or PM picks one on the Design tab (any
  time after booking). It puts them on the project's team; changing the
  designer takes the old designer off. Phase 1's booking code is not touched.

### 2. Design steps (the DESIGN stage of the step tracker)
- Every new project's DESIGN stage gets the studio's **design steps** (Settings
  → Design steps; Hauspire's 19 by default) instead of the one "Final design
  and drawings signed off" step. Same table, same tracker, same edits in the
  Plan tab (rename, add, remove, weight, scope).
- Each step also has: **who does it** (designer, sales, accounts, PM, client),
  **document required** (ticking asks for the file, which is filed in the
  locker — team-only by default, "show the client" optional), a **payment gate**
  (locked until that payment stage is recorded; Hauspire: design advance on
  the FD meeting, design closure on the BOQ) and **days after the previous
  step**.
- Weights: the design steps share the DESIGN stage's existing 2% of the whole
  project, so execution percentages do not change; the Design tab shows each
  step's share **of the design phase**, and the client sees "Design 45%".
- Dates: with the flat size known (the brief's BHK), the design stage lasts
  14/24/27/29 days and each step is planned "previous + N days" (Hauspire's
  2 BHK gaps, scaled). Without it, the design stage keeps today's share.
- **Tick** (owner, PM, designer): one button per step; the next open step is
  highlighted. Needs the gate open and, when required, the file. A sentence of
  what was done is optional and stays with the team.
- **Running late**: "Move" on a step: new date, **client side** (not
  available, not responding, possession late, payment pending, many changes)
  or **studio side** (designer on leave, workload, other). The later design
  steps move by the same days (linked). Kept as history; the client sees the
  new date and a plain reason, never the note. The plan's stage dates are not
  moved by themselves: the tab says how far past the plan design now ends and
  links to "Move a date" in the Plan tab.
- Site mode cannot tick design steps (they are ticked on the Design tab).

### 3. Mood board
- Uses the client's existing mood board (`/prepare`, `PrepRoom` on their
  brief). "Share the mood board" (designer) with a short message → the client
  gets a notice and a "Fill your mood board" card in the app and website.
- The Design tab shows what the client picked per room (pieces, choice, their
  note) and lets the designer **add pieces** to a room for the client to see.

### 4. Site visit and measurements
- **Book the visit**: day, time, what it is for; mark done or cancelled. The
  client sees the day and time (and gets a notice). The note stays inside.
- **Measurements**: a simple per-room list (room, length × width × height in
  feet), editable. Site photos go to the locker as team files.

### 5. Drawings and 3D for approval
- Upload per room: **2D layout, furniture layout, 3D render** (PDF or image).
  Sharing it sends the client one notice. A revision is a new version of the
  same drawing (the locker's versions), so the revision count is the version.
- The client **approves** or **asks for changes** with a comment, in the app or
  on the website. The Design tab shows each drawing: waiting n days / approved
  / changes asked (with the comment), and a "remind" line the designer can
  copy into their own WhatsApp. No automatic chasing.

### 6. Design final
- On the Design tab: the signed quotation (the sales final); **Make Design
  Final** (owner, PM) calls the existing quotation copy ("2026-004-D"), opens
  it and its compare page. **Close design** (owner, PM) records the design
  final and keeps a frozen "what changed vs the sales final" for the client
  (added, removed, re-priced lines and the new total). Agent Q's quotation
  module is only called, never edited.

### 7. What the client sees (website /app and the phone app)
- A **Design** card while design is open: design % and the steps (done, next,
  planned days), "Next: First draft meeting · opens when the Design advance is
  paid", the designer's first name, the site visit, the mood board card,
  drawings to approve, and after closing, what changed vs the sales final.
- Projection rule unchanged: field by field, from a named select. Never the
  step note, the visit note, delay notes, who did what, drafts, the studio's
  costs. The no-leak test gains the design fields.

### 8. Designer workload (owner, PM)
- `/studio/design`: each designer, their open design projects, steps due this
  week and late, and a rough load: designer-days per project (1 BHK 14,
  2 BHK 20, 3 BHK 27, 4 BHK 32) × what is left, against 25 days a month.
- A designer opening the same page sees only their own projects, each with
  its next step.

## Data (expand only; migration `20261012140000_studio_design_phase2`, not applied)
- `StudioRole` gains `DESIGNER`. `Studio.designTemplate` (JSON).
- `HomeProject`: `designerId`, `moodBoardSharedAt`, `moodBoardNote`,
  `designFinalQuoteId`, `designClosedAt`, `designChanges` (JSON, frozen).
- `HomeChecklistItem`: `responsible`, `needsDocument`, `gatePayment` (payment
  stage index), `gapDays`, `doneNote` (team only), `doneDocumentId`.
- `HomeDocument`: `designKind` (LAYOUT_2D, FURNITURE, RENDER_3D, WORKING,
  SITE_PHOTO), `room`.
- New: `HomeSiteVisit`, `HomeMeasurement`, `HomeDesignReview` (append-only),
  `HomeStepDelay` (append-only).

## Not in Phase 2
Execution (procurement, dispatch, vendors: Phase 3), online payments, automatic
reminders to clients, re-planning a project's design dates when the flat size
changes after booking, a calendar for designers.

## Done when (tried with Hauspire)
Accounts records the ₹25,000 booking; the owner picks Meera as designer; Meera
(who sees only her projects) books the site visit, records the rooms, shares
the mood board; the client fills it in the app; Meera uploads the 2D layout,
the client asks for a change, R2 is approved; the FD meeting step stays locked
until accounts records the design advance; the BOQ needs its file; the owner
makes the Design Final and closes design; the client's app shows what changed.
The owner's design page shows Meera's load against her month.
