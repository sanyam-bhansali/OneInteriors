# Studio workspace — Phase 1 foundation

**Written:** 11 Oct 2026 · **For:** whoever builds sign-in and Team (B) and
quote-to-plan and the office workspace (C) on top of this.
**Plan:** `PHASE-1-PLAN.md` §1 and §6 are done here; §2–§5 build on it.

## The migration

`prisma/migrations/20261011140000_studio_workspace_foundation` — expand-only,
not applied anywhere yet (Sanyam runs `db:deploy`). Verified by applying all
72 migrations to a throwaway in-memory Postgres (PGlite), including both
backfills.

| Change | Notes |
|---|---|
| `StudioMember.role` `StudioRole` (`OWNER`, `PM`, `SUPERVISOR`, `ACCOUNTS`), default `OWNER` | Backfilled: `isOwner` → `OWNER`, else `PM`. **Decide permissions on `role`, never `isOwner`.** `isOwner` stays until a contract migration; keep writing it in step (`application.ts` does) |
| `StudioMember.status` `StudioMemberStatus` (`INVITED`, `ACTIVE`, `SUSPENDED`), default `ACTIVE` | Only `ACTIVE` can do anything |
| `StudioMember.invitedById` (→ `StudioMember`, SetNull), `invitedAt`, `lastSeenAt` | Phone and language stay on `User` (`phone`, `locale`). `userId` stays unique: one person, one studio |
| `StudioProjectMember` (`homeProjectId` → `HomeProject`, `memberId` → `StudioMember`, unique pair) | Which PM/supervisor is on which customer project. Owners and accounts need no rows. `homeProjectId`, not `projectId`, so it is never confused with `StudioProject` |
| `HomeProjectStage` (`projectId`, `kind` `ProjectStageKind` `DESIGN`/`CIVIL`/`CARPENTRY`/`FINISH`/`HANDOVER`, `name`, `sortOrder`, `plannedStart`, `plannedEnd`, `actualEnd?`) | Studio owns `name` and dates; we own `kind`. Query the kind. No unique on (project, kind) — the generator decides |
| `HomeChecklistItem` (`stageId`, `room`, `label`, `quoteLineId?`, `sortOrder`, `doneAt?`, `doneById?`, `doneSource` `ChecklistDoneSource` `TICK`/`VOICE`?) | `quoteLineId` and `doneById` are plain strings, not foreign keys (snapshot reference; a leaver's ticks stay) |
| `HomeMaterial` (`projectId`, `room`, `item`, `spec?`, `quoteLineId?`, `productCode?`, `sortOrder`) | Copied at signing |
| `HomeDocument.sharedAt?`, `version` (default 1), `supersedesId?` (→ `HomeDocument`, SetNull) | Backfilled `sharedAt = createdAt`, so nothing visible today disappears. `sharedAt` null = draft, studio only |
| `HomeProject.teamNotes?` | The "Only your team" notes. Never selected by the customer projection |

The Home\* children use `projectId` like their siblings (`HomeDecision`,
`HomeSnag`, `HomeDocument`). Relations on `HomeProject`: `team`, `stages`,
`materials`; on `StudioMember`: `projects`, `invitedBy`, `invitees`.

Every new table has RLS + `REVOKE` and an index on each foreign key.

## Permissions — `src/modules/studio/roles.ts` (pure)

```ts
type StudioAction =
  | 'team.manage' | 'project.create' | 'plan.edit' | 'update.post' | 'checklist.tick'
  | 'decision.create' | 'snag.accept' | 'snag.fix' | 'payment.record' | 'payment.read'
  | 'document.upload' | 'vendor.rates' | 'project.read';

can(member: { role, status }, action, ctx?: { assigned?: boolean }): boolean
projectsVisibleTo(member: { id, studioId, role, status }, purpose?: 'project' | 'payments'): Prisma.HomeProjectWhereInput
needsAssignment(role): boolean          // PM, SUPERVISOR
isSeat(member): boolean                 // status === 'ACTIVE'
FREE_SEATS = 5
sessionDaysFor(role): number            // SUPERVISOR 90, others 30 — computed, no column
STUDIO_ROLES, STUDIO_ACTIONS
```

| Action | Owner | PM | Supervisor | Accounts |
|---|---|---|---|---|
| `team.manage` | ✓ | | | |
| `project.create` | ✓ | ✓ | | |
| `plan.edit` (incl. setting a payment's due date) | ✓ | assigned | | |
| `update.post`, `checklist.tick`, `snag.fix`, `project.read` | ✓ | assigned | assigned | |
| `decision.create`, `snag.accept` (accept, fix-by, assign, raise), `document.upload` | ✓ | assigned | | |
| `payment.record` (mark received) | ✓ | | | all projects |
| `payment.read` | ✓ | assigned | | all projects |
| `vendor.rates` | ✓ | | | |

Anyone not `ACTIVE` gets `false` for everything. `can()` without `assigned`
refuses project actions for PM/supervisor (the safe default).

`projectsVisibleTo` is the `where` for any list of customer projects: owner →
the studio's; PM/supervisor → the studio's AND `team.some.memberId`; accounts →
none for `'project'`, all for `'payments'`; inactive → `{ id: { in: [] } }`.

## Access against the database — `src/modules/studio/access.ts` (server-only)

```ts
memberFor(userId): Promise<StudioMemberRef | null>         // { id, studioId, userId, role, status }
currentMember(): Promise<StudioMemberRef | null>           // signed-in, STUDIO role; never throws
accessTo(member, homeProjectId): Promise<{ assigned, may(action) } | null>   // null = not this studio's project
memberOnProject(homeProjectId, action?): Promise<{ ok: true, member, access } | { ok: false, error }>
mayDo(member, action, homeProjectId?): Promise<boolean>
assertCan(member | null, action, homeProjectId?): Promise<void>   // throws StudioAccessError — server actions only
studioIdFor(action): Promise<string | null>                // studio id if the signed-in member may (e.g. 'vendor.rates')
ACCESS_ERRORS = { signIn, notYours, notYourRole }
```

`memberOnProject` is the entry point for any studio-side read or write of a
customer project. It always checks the project belongs to the member's
studio before asking `can()`. A member who cannot even see the project is told
"not one of yours", never "your role…".

Wired in already:

- `portal/project-store.ts` `staffFor(projectId, action?)` (ops still pass
  everything): `postDecision` → `decision.create`; `fixSnag` → `snag.fix`;
  `setSnagFixBy`, `raiseSnagAsStaff` → `snag.accept`; `addDocument`,
  `removeDocument` → `document.upload`; `setPaymentStage` → `paidOn` needs
  `payment.record`, `dueOn` needs `payment.record` or `plan.edit`;
  `projectWork` → any visibility; accounts get money only, supervisors get no
  money. `StaffWork.documents[].shared` added. `addDocument` sets `sharedAt`
  to now (today's behaviour); a draft upload should leave it null.
- `portal/tracker-store.ts`: `setStudioStageDone` → `checklist.tick`,
  `postStudioUpdate` → `update.post`, `projectsForStudio` → `projectsVisibleTo`.
- `studio-practice/vendors.ts`: every read and write is owner-only
  (`vendor.rates`); `studio-practice/projects.ts` `myProjects` zeroes vendor
  bills for anyone else. There are no cost fields on the product master
  (`StudioProduct.ratePaise` is the selling rate).

Tests: `tests/studio-roles.test.ts` (every cell), `tests/studio-access.test.ts`
(mocked Prisma: the writers above per role).

## What B needs to know (sign-in, MessageSender, Team)

- Invite = `User` (phone, name, role `STUDIO`) + `StudioMember` (`role`,
  `status: 'INVITED'`, `invitedById`, `invitedAt`, `isOwner: role === 'OWNER'`)
  + `StudioProjectMember` rows for chosen sites. Gate with
  `assertCan(member, 'team.manage')`.
- First studio sign-in: `INVITED` → `ACTIVE`; set `lastSeenAt`. Session length
  `sessionDaysFor(role)` (`auth/session.ts` has a fixed `SESSION_DAYS = 30`
  today — needs a parameter).
- Suspend: `status: 'SUSPENDED'` + `revokeAllSessions`. `can()` already refuses
  a suspended member with a live session.
- **Not yet role-gated:** the rest of `/studio` (clients, quotes, product
  master, pipeline, settings) is still scoped by studio only. Harmless while
  every member is OWNER or PM, but before a SUPERVISOR or ACCOUNTS member can
  sign in, the layout/navigation and those modules need gating (supervisor →
  `/studio/site` only).

## What C needs to know (quote-to-plan, workspace)

- Write stages/items/materials with `projectId` = the `HomeProject` id; read
  stages by `kind`. `doneStages` is still what the customer tracker reads
  (`trackerView`) until the projection is switched to `HomeProjectStage`.
- Office lists: `prisma.homeProject.findMany({ where: projectsVisibleTo(member) })`;
  accounts' payments list: `projectsVisibleTo(member, 'payments')`.
- Gate each workspace action with `memberOnProject(id, action)`; a plan edit is
  `plan.edit`, a checklist tick `checklist.tick`, notes are `project.read` to
  see and `plan.edit` to write (a judgement call — change it in `roles.ts`).
- Drafts: create `HomeDocument` with `sharedAt: null`; sharing sets it. A new
  revision is a new row with `version + 1` and `supersedesId`.

## The customer projection — `src/modules/portal/customer-project.ts`

`customerProjects(userId, now?, { links? })` moved here; `project-store.ts`
re-exports it and the `Customer*` types, so callers and test mocks are
unchanged. The rules are in the pure `customer-project-view.ts`:

- `CUSTOMER_PROJECT_SELECT` — every column read; documents
  `where: { deletedAt: null, sharedAt: { not: null } }`. Adding a field there
  is deciding the customer sees it.
- `toCustomerProject(row, userId, now, links)` — field by field, never a spread.
- `customerPhases(signed, studioFiled)` — the plan as signed
  (`HomeProject.paymentPhases`); the studio's filed schedule only when nothing
  was signed. Also used by `trackersForBrief` (the website account page).

`tests/customer-projection.test.ts` feeds a row stuffed with studio cost,
transcript, voice path, team notes, crew phone, wages, poster ids and storage
keys, and asserts none appear in the output by key or value.

When phase 2 adds site logs, crew and voice notes: extend the select and the
mapper with the left column of the brief's §5 only, and add the new internal
fields to the leaky row in that test.
