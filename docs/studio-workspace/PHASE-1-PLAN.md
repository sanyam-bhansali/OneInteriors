# Studio workspace — Phase 1 plan (team, sign-in, projects)

**For:** Sanyam's go-ahead · **Written:** 11 Oct 2026 · **Brief:** `STUDIO-WORKSPACE-BUILD.md`

Owner's decisions this plan follows (11 Oct 2026):

- Build on the customer's project record (`HomeProject` and its tables), which
  signing already creates and the customer app already reads. The hidden
  internal `StudioProject` is folded into it later, not extended.
- The studio side keeps its current deep-green palette.
- Studio staff may get sign-in codes and reminders on WhatsApp, SMS as the
  fallback. Customers stay app and email only.
- The studio phone app is a second Expo app (phase 6), not Capacitor.
- The brief's "Self-managed vs Assured" is Basic vs Assured.

## What already exists and is reused

| Need | Already in the code |
|---|---|
| Studio members | `StudioMember` (studioId, userId, isOwner) |
| Phone sign-in | `modules/auth/otp.ts` + `LoginChallenge` + sessions, `revokeAllSessions` |
| Studio guard | `app/studio/layout.tsx` (STUDIO role), `studio/tenancy.ts myStudioId()`, tenant-scope test |
| Writing to the customer's record | `/studio/updates` + `components/project-work/ProjectWork.tsx` (updates, stages, decisions, snags, documents, payment dates) |
| Customer read | `portal/project-store.ts customerProjects` (already a hand-mapped projection) |
| Payments maths | `studio-quote/pricing.ts splitAcross`, `studio-practice/ledger.ts canPay` |
| Signing | `portal/choose.ts signFinalQuote` (creates the `HomeProject`, with Basic/Assured since 11 Oct) |

## Phase 1 — what gets built

### 1. Roles and team (database + module layer)

- `StudioMember` gains `role` (`OWNER`, `PM`, `SUPERVISOR`, `ACCOUNTS`),
  `status` (`INVITED`, `ACTIVE`, `SUSPENDED`), `invitedById`, `lastSeenAt`.
  `isOwner` stays for now and is derived from `role` (expand → migrate →
  contract). The member's phone and language stay on `User` (`phone`,
  `locale`), so one person is one account.
- **Limit to confirm:** `StudioMember.userId` is unique, so one person belongs
  to one studio. The brief assumes the same; a supervisor working for two
  studios would need a second number. Kept as is unless you say otherwise.
- New `StudioProjectMember` (projectId → `HomeProject`, memberId): which PM or
  supervisor sees which project. (Named so it doesn't clash with the existing
  `ProjectStage` enum and similar.)
- `modules/studio/roles.ts` (pure): the brief's permission table as one
  function, `can(member, action, project?)`. Every read and write of a
  project goes through it in the module layer, not only the UI.
- `staffFor` in `project-store.ts` (today: any member of the studio) checks
  the role and the project assignment.
- Tests: every cell of the table that matters, at least "a supervisor cannot
  read an unassigned project", "a PM cannot read vendor rates", "accounts
  sees payments only".

### 2. Phone sign-in for studio staff

- `/studio/sign-in` (design: `studio/StudioSignIn.dc.html`): EN / हिं / मरा,
  mobile number, 6 code boxes, "Sent on WhatsApp", "Your studio owner adds
  team members from Settings, Team."
- Reuses `otp.ts`. A number that belongs to an invited or active studio
  member signs in as that member (first sign-in turns `INVITED` into
  `ACTIVE`); any other number is told to ask their studio owner. It never
  creates a customer from the studio sign-in.
- Adds the **per-IP limit** the brief asks for (the IP hash is stored today
  but never checked; `modules/rate-limit/` exists).
- `MessageSender` adapter (`modules/messaging/`): WhatsApp template when
  approved → SMS fallback → console in development. **Needs from you:** the
  SMS provider, and the WhatsApp template name once Meta approves it. Until
  then studio codes show on screen only in local development (the existing
  production guard in `lib/env.ts` already refuses it on a deployed build;
  a test is added to pin that for studios).
- Sessions: supervisors 90 days, everyone else stays 30; the owner can sign a
  member out of all devices (`revokeAllSessions`).
- Email sign-in for studio owners keeps working alongside, so nobody is
  locked out on the day this ships.
- After sign-in: owner / PM → the office dashboard; supervisor →
  `/studio/site` (a placeholder "My sites today" until phase 2).

### 3. Settings → Team (design: `studio/StudioTeam.dc.html`)

- People table: name, role, sites, last active, language, status.
- "Add someone": name, phone, role (cards explaining each role), sites.
  Sends the invite through `MessageSender`. Resend, suspend, sign out of all
  devices.
- Seat counter: 5 free. A seat is a member who has signed in at least once
  and is not suspended.

### 4. Plan from the signed quote (`quote-to-plan.ts`)

- Pure function: signed quote lines → stages, a checklist per room, the
  payment schedule, the materials list. Tested so payments always sum
  exactly to the contract.
- New tables (append-friendly, RLS + indexes):
  - `HomeProjectStage` (projectId, kind `DESIGN|CIVIL|CARPENTRY|FINISH|HANDOVER`,
    name, sortOrder, plannedStart, plannedEnd, actualEnd). `kind` is fixed,
    `name` is the studio's. Replaces the fixed `doneStages` keys; the
    customer app keeps reading the same shape through the projection.
  - `HomeChecklistItem` (stageId, room, label, quoteLineId, sortOrder,
    doneAt, doneById, doneSource). Generated, never typed.
  - `HomeMaterial` (projectId, room, item, spec, quoteLineId, productCode?).
- `signFinalQuote` calls it in the same transaction, and also files the
  agreement and the final quote as documents in the locker (today it does
  neither).
- Existing projects (signed before this) get their plan built once by a
  script you run, so nobody types anything.

### 5. Office: Projects and the project workspace

- **Projects** (design: `studio/StudioProjects.dc.html`): the table (home and
  customer, stage, today on site, overall status, open snags, waiting on the
  customer, next payment, plan Basic/Assured) and the "Needs attention today"
  strip (no update yet, snag overdue, payment to record, waiting on the
  customer, labelled "not your delay").
- **Project workspace** (design: `studio/StudioProject.dc.html`): header chips
  (customer, flat, tier, contract, plan, "customer app connected"), the
  **Plan** tab read-only in this phase, the dark "What {customer} sees right
  now" panel, the Home locker card and the "Only your team" notes.
- The existing `/studio/updates` keeps working until phase 2 replaces it.

### 6. The customer projection, made safe

- `portal/customer-project.ts`: the one projection the customer app and
  website read (today's `customerProjects`, moved and tightened). A test
  asserts no internal field (studio cost, transcript, voice path, internal
  notes, crew phone) can appear in its output.
- Fixes found in the audit: the customer's payment plan reads the signed copy,
  not the studio's current one; documents gain `sharedAt` so drafts stay with
  the studio.

### 7. Studio side in three languages

- A small EN / हिं / मरा layer for the studio surfaces this phase touches
  (sign-in, site placeholder, team invite), reusing the customer site's
  `oa.lang` convention. Office screens stay English in phase 1; site mode is
  fully translated in phase 2.

## Done when (the brief's test)

- An owner invites a supervisor by phone; the supervisor signs in and sees
  only their site.
- A signed quote produces the full plan with no typing.
- Tests cover `quote-to-plan.ts` (stages, items, payments summing exactly to
  the contract) and the permission table.

## What I need from you before or during Phase 1

1. The SMS provider for studio codes (and invites), and the WhatsApp template
   once approved.
2. OK that one person = one studio (see section 1).
3. Migrations: I write them; you run them on production, as before.
