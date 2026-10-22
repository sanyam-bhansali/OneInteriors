# Sales roles and teams

Built 22 Oct 2026 (owner's decisions, 22 Oct 2026). The sales side of the
studio software gets editable roles, a reach on every lead permission, a
reporting tree, team pools, and "New leads go to: a team's pool". Designers,
project managers, supervisors, accounts and the owner keep exactly the fixed
rights they had (`src/modules/studio/roles.ts` GRANTS): nothing about
projects, payments, crews, design or site changed.

Migration: `prisma/migrations/20261022110000_sales_roles_teams` (expand only;
not applied anywhere by the build).

## The model

- **Fixed role stays.** A salesperson is still `StudioMember.role = SALES`.
  The sales role *refines* it.
- **Sales role** (`StudioSalesRole`): a named set of sales permissions per
  studio. Each SALES member has at most one (`StudioMember.salesRoleId`).
  Editing a role changes everyone on it from their next page.
- **No sales role = Phase 1.** A SALES member without a sales role works
  exactly as before 22 Oct: their own leads, and claims from the studio pool.
- **Reporting tree.** `StudioMember.reportsToId` names another salesperson of
  the same studio; null means "reports to the owner". A person's **team** is
  everyone below them at any depth, themselves included. Same studio, no loops
  and salespeople only are checked on every write (`sales-access.ts
  checkReportsTo`, run inside a serializable transaction); the resolver also
  walks cycle-safe, so a bad row can never widen anyone's reach.
- **Team pools.** An unassigned lead sits in a pool: a head's team pool
  (`StudioClient.poolTeamId` = the head) or the studio pool (null). The head
  hands their pool's leads out to their team; reps claim from the pools of the
  teams they are in.

Code:

| File | What |
|---|---|
| `src/modules/studio/sales-permissions.ts` | The catalogue, built-in roles, reading a stored role, the role form check (pure) |
| `src/modules/studio/sales-access.ts` | The resolver: tree, reach tests and `where`s, pools, who may be assigned, `buildersOf` (pure) |
| `src/modules/studio/roles.ts` | `can()` hands a SALES member with a role to the resolver; `leadsVisibleTo`, `poolVisibleTo`, `quotesVisibleTo`, `leadsWhereFor` |
| `src/modules/studio/access.ts` | `memberFor` builds the per-request `SalesContext` (role + subtree, tree read once per request) |
| `src/modules/studio/lead-scope.ts` | `LeadScope` (`reach`, `team`, `pools`, `quotesWritable`), `mayOnLead`, `fenceFor`, `scopeFor`, `analyticsScope` |
| `src/modules/studio/sales-team-store.ts` | Roles CRUD, a person's role, reporting lines (owner or `team.sales`) |
| `src/modules/studio-sales/lead-sql.ts` | The same fences as raw SQL for GROUP BY reads |

## The catalogue

| Key | Group | Reach | What it opens |
|---|---|---|---|
| `leads.view` | Leads | own / team / all | Board, list, lead page, search, Today, calendar, lead neighbours |
| `leads.edit` | Leads | own / team / all | Details, notes, files, meeting, column moves, tags, tasks and follow-ups |
| `leads.add` | Leads | on/off | Add a lead by hand (it is theirs; with all reach it goes to the pool) |
| `leads.merge` | Leads | on/off | Merge duplicates — both leads within their `leads.edit` reach |
| `leads.delete` | Leads | on/off | Bin, restore, erase — leads they can see |
| `leads.import` | Leads | on/off | Import a spreadsheet; lands in the studio pool (all pool reach) or their own team pool |
| `leads.export` | Leads | on/off | Download the list — only leads they may see in full. Off in every built-in |
| `leads.bulk` | Leads | own / team / all | Bulk actions; rows fenced by this reach AND the action's own |
| `leads.pool` | Pool & assigning | team / all | Which pools they see and claim from |
| `leads.assign` | Pool & assigning | team / all | Give leads out, or put them back in / move them to a pool |
| `calls.log` | Calling | own / team / all | Log a call (and the move the call sheet offers) |
| `quotes.write` | Quotations | own / team / all | First quote, builder, revisions, sending |
| `quotes.salesFinal` | Quotations | own / team / all | Mark the sales final |
| `quotes.build` | Quotations | on/off | **Builds quotations**: gets quotation requests (floor plan added / quotation requested on a lead), handed out in turns among everyone with this permission; sees the lead, floor plan and first-quote draft of requests given to them, whatever their lead reach. The request queue is built (22 Oct 2026): docs/studio-os/QUOTE-REQUESTS.md. Who is in the turns is `studio-quote/quote-request-rules.ts turnOrder` (SALES with the key; a plain owner only when the studio lists them under Settings → Team → Quotations). `sales-access.ts buildersOf` (which counts owners) is not used by the queue |
| `analytics.view` | Analytics | team / all | Lead analytics, calling numbers, by campaign, the dashboard's people table |
| `settings.leads` | Settings | on/off | Pipeline, lead fields, lead sources, lead doors, "New leads go to" |
| `team.manageSales` | Team | on/off | Settings → Team for salespeople: invite them, roles, reporting lines |

Stored as `{ "<key>": "own" | "team" | "all" | true }`. Unknown keys, unknown
reaches, a reach a key does not take, and anything that is not exactly `true`
for an on/off key are dropped when read: an unreadable value never grants.

How `can()` actions map (`roles.ts SALES_KEY_FOR`): `lead.read` → leads.view,
`lead.edit` → leads.edit, `lead.call` → calls.log, `lead.add`, `lead.assign`,
`lead.merge`, `lead.delete`, `lead.import`, `lead.export`, `lead.pool` and
`lead.claim` → leads.pool, `lead.bulk`, `lead.analytics` → analytics.view,
`lead.settings` → settings.leads, `team.sales` → team.manageSales,
`quote.write`, `quote.salesFinal`, `quote.build`. Anything else is refused for
a SALES member with a role (SALES had no other grant). The new fixed-role
actions: PM gets `lead.call`, `lead.bulk`, `lead.analytics`, `lead.settings`
(what they could already do); SALES without a role gets `lead.call` and
`lead.bulk` (own leads, as before); the owner has everything.

## Reach rules

For a lead with owner `assignedToId` and pool `poolTeamId`:

- **own** — `assignedToId = me`.
- **team** — `assignedToId ∈ my subtree` (me included), OR (`assignedToId IS
  NULL` AND `poolTeamId ∈ my subtree`).
- **all** — every lead of the studio.

The rule is written once as a test (`leadInReach`) and once as a Prisma
`where` (`reachWhere`); tests run both over the same rows. Every write ANDs
what they can see (`leads.view`) with the action's own reach (`fenceFor`), so
seeing a lead never alone lets anyone change it. A question asked without the
lead's facts gets the safe answer (own leads only).

Pools (`leads.pool`):

- **all** — every team pool and the studio pool.
- **team** — the team pools of the heads above them (the teams they are in),
  their own, and those of heads below them; plus the studio pool only when
  they report straight to the owner (the studio pool is the owner's own team
  pool). So an existing rep (reporting to the owner) claims from the studio
  pool exactly as before; a rep under a head claims from that head's pool.

Assigning (`leads.assign`): only leads within the reach, only to people
within it (team: their subtree). On the lead page and the pool, someone with
team reach assigning a lead from a head's team pool is offered only that
head's team. Giving a lead back to the pool: with team reach it goes into
their own team pool; with all reach it keeps its pool. Moving a lead into a
pool: the studio pool needs all reach; a team pool, a head within their team.

Numbers (`analytics.view`): team = their subtree's numbers only (calls their
team made, leads their team has); all = the studio's; without it, their own
(the dashboard as before).

Tasks: a sales role sees the tasks of the people `leads.view` reaches,
changes those `leads.edit` reaches, and gives tasks to the people
`leads.assign` reaches (else only themselves). "My work" stays a
salesperson's own leads whatever their reach; their team's follow-ups are on
Today.

## Built-in roles (every studio; renamable and editable, never deleted)

| Permission | Admin | Sales head | Sales rep |
|---|---|---|---|
| leads.view | all | team | own |
| leads.edit | all | team | own |
| leads.add | ✓ | ✓ | ✓ |
| leads.merge | ✓ | | |
| leads.delete | ✓ | | |
| leads.import | ✓ | | |
| leads.export | | | |
| leads.bulk | all | team | own |
| leads.pool | all | team | team |
| leads.assign | all | team | |
| calls.log | all | team | own |
| quotes.write | all | team | own |
| quotes.salesFinal | all | team | own |
| quotes.build | ✓ | ✓ | |
| analytics.view | all | team | |
| settings.leads | ✓ | | |
| team.manageSales | ✓ | | |

The migration gives every existing SALES member **Sales rep**, reporting to
the owner: the Phase 1 salesperson exactly. New studios get the three roles at
approval (`provision.ts`), and older studios lazily on the Roles tab.
`leads.export` is off in Admin because the leads download stayed the owner's
decision (22 Oct 2026): the owner switches it on for a role if they want.

## New leads go to: a team's pool

`LeadRouteMode` gains `TEAM`. The head is the existing member column
(`Studio.leadRouteMemberId`, `StudioLeadConnection.routeMemberId`). A lead
lands unassigned in that head's team pool, with a timeline line ("In Asha's
team pool (new leads go to Asha's team)") and the head told in their inbox.
A head who has left, is suspended or is not a salesperson is unavailable and
the lead falls to the studio pool. Settings → Lead sources has "A team's pool"
with a head picker, for the studio and per lead door.

## Screens

- **Settings → Team** (owner; or a salesperson with `team.manageSales`, who
  sees and invites salespeople only): three tabs.
  - *People*: each salesperson's sales role and who they report to (the
    reports-to list leaves out anyone already below them).
  - *Roles*: each role as a permission matrix — on/off, and a reach for the
    lead permissions, grouped Leads, Pool & assigning, Calling, Quotations,
    Analytics, Settings, Team; make, rename, edit; delete only an unused,
    non-built-in role.
  - *Reporting lines*: the tree, owner at the top.
  - Inviting someone as Sales asks for their sales role (default Sales rep)
    and who they report to.
  - Someone managing the sales team who is not the owner cannot change their
    own role, its permissions, or their own reporting line.
- **Leads**: with team reach the list is "My team's leads", with a person
  picker limited to the team and a "who has it" column.
- **The pool**: tabs for "All my pools", the studio pool and each team pool
  they may see (with counts); whoever may assign hands out leads or moves them
  into a pool.
- A salesperson's role also opens Import, the Bin, lead Analytics / Calling,
  Settings → Pipeline / Fields / Lead sources, and Settings → Team, each only
  with the matching right (`surfaces.ts`). Terms, appointments and the rest of
  the office stay closed.

Plans: on Pro Solo there is no team (Team stays closed); on Pro and Max the
hierarchy works.

## Setting up "Admin → 2 Sales heads (each sees only their team) → reps"

1. Settings → Team → People: give the sales manager the **Admin** role (or keep
   it to the owner). Leave their reporting line as "Reports to the owner".
2. Give the two heads (say Asha and Ravi) **Sales head**, both reporting to the
   owner (or to the Admin).
3. Give each rep **Sales rep** and set "Reports to Asha" or "Reports to Ravi".
   A team lead in between works too: Rep → Team lead → Asha.
4. Settings → Lead sources → New leads go to: **A team's pool** → Asha's team
   (or set it per lead door: Meta to Asha's team, 99acres to Ravi's).
5. Asha now sees and works only her team's leads and her team pool, hands
   them out from the pool, and sees her team's numbers; Ravi the same for his.
   Neither sees the other's team. Reps see their own leads and claim from
   their head's pool. If heads should not see the studio pool, make them
   report to the Admin instead of the owner.

## Tests

- `tests/studio-sales-permissions.test.ts` — the catalogue, reading, the role
  form, the built-ins, and that the migration writes exactly them.
- `tests/studio-sales-access.test.ts` — tree and cycles, cross-studio
  rejects, own/team/all as rule and query, pools, assigning, `can()` and every
  where builder, no-role = Phase 1, fixed roles untouched, tasks, screens,
  bulk, routing TEAM.
- `tests/sales-roles-db.integration.test.ts` — against the local test
  database only (`SALES_ROLES_TEST_DB=1`, 127.0.0.1:54329), after the
  migration is applied there.
