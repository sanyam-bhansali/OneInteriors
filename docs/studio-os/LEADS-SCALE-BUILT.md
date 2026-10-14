# Leads at scale — built (12 Oct 2026)

**For:** the owner's 12 Oct requests. Hauspire has 26,000 leads, adds 700–800 a day, and has 4 salespeople.
**Migration:** `prisma/migrations/20261012120000_studio_leads_scale`. It only adds indexes and one new table. It has **not been applied** anywhere.
**Rule kept:** easy, not automatic. Nothing assigns, moves or writes a task unless someone chooses to. Every bulk action asks first and says what it did.

## What was built, and where

| Request | Where |
|---|---|
| **Filters in the URL** (one definition used by the list, board, dashboard, bulk actions and saved views) | `src/modules/studio-sales/lead-filters.ts` (pure): `parseLeadFilters` / `leadFiltersToQuery`, `leadWhere`, `scopedLeadWhere`, sorts + keyset cursor, chip words. India-day ranges are in `ist-range.ts` (`today`, `yesterday`, `7d`, `30d`, `week`, `month`, `any`, `YYYY-MM-DD..YYYY-MM-DD`) |
| **List view** (the default above 300 leads) | `app/studio/clients/page.tsx`, `LeadList.tsx`, `FilterBar.tsx`. Reads come from `studio-sales/leads-list.ts` `leadPage`: 50 rows per page, keyset (not offset), with the total from `count` |
| **Filters** | search (name / society / phone), source (ours or the studio's own), column or kind, whose (everyone / pool / somebody / a person — SALES: mine / pool), follow-up (today / missed / due / later / none), date added (presets or custom), not contacted, gone quiet. Dashboard links add contacted / meeting / quotation sent / sales final / booked ranges and lost reason. Each filter shows as a removable chip |
| **Sorting** | newest, oldest, follow-up date (no date last), longest since a call (never called first), name |
| **Selection + bulk actions** | Tick rows, select this page, select the first 100 / 500 / 1,000, or select all N matching. Actions: claim for myself, give to one person (or back to the pool), split evenly (people take turns), move to a column (a lost column asks why), set a follow-up (day, optional time and action), delete to the bin. Rules are in `bulk-rules.ts`; writes are in `bulk.ts` (ids re-read inside the person's scope, 1,000 per statement, one timeline line per lead, the person told once); server actions are in `clients/list-actions.ts` |
| **Board** | `Board.tsx` + `leads-list.ts boardData`: each column's count and due count come from SQL `groupBy`. It loads the first 50 cards per column, "Show N more" (50 at a time, same filters) and "All N as a list". Finished/lost: count + first 50 + a link to the list. Search / source / column / who now come from the shared filter bar. Group-by stays as before |
| **Saved views** | `view-filters.ts` now stores `{ query, view, groupBy }`, cleaned by parsing again. Old `who` views are turned into the same filter. `ViewsBar.tsx` applies a view by opening its URL |
| **Import, 26,000 rows** | `Import.tsx` splits the file into 1,000-row CSV pieces (`csv.ts csvChunks`, header on each piece, smaller pieces if one is too long) and sends them one after another with progress ("Adding… 3,000 of 26,000"). If it stops, it says how far it got, and re-running is safe. The server still re-parses each piece. `importClients` checks phones 1,000 at a time and writes 500 at a time with `createManyAndReturn`, so every row gets its CREATED line. **Dry run:** "Check how many are already on your list" shows already-there vs new (`countExistingPhones`), next to no-name / repeated / Excel-damaged counts. File limit is 25 MB. **CSV only**: no xlsx library is in package.json, and the screen says "in Excel, File, Save As, CSV" |
| **Dashboard** (nav "Dashboard", `/studio/dashboard`) | `dashboard-rules.ts` (each number is a set of filters), `dashboard.ts` (SQL `count` / `groupBy` / `aggregate` only), `app/studio/dashboard/page.tsx` + `RangePicker.tsx`. **Right now:** total, in the pool, due today, missed, not contacted, gone quiet, meetings today / this week. **New:** today / 7 days / this month. **Range** (Today, 7 days, 30 days, this month, pick dates): new, contacted, quotations sent, sales finals, bookings, booked value, conversion. Also lost (with top reasons), by source (leads / booked / %), and by salesperson (open, contacted today, due today, missed, quotes sent, bookings). Every number opens the list with exactly those leads |
| **Calendar** (nav "Calendar", `/studio/calendar`) | `calendar-rules.ts` (pure), `calendar.ts`, `app/studio/calendar/page.tsx` + `CalendarView.tsx`. Day / week / month views of follow-ups (a follow-up with no time goes at 10 am IST), meetings, tasks, and for owner/PM the One Interiors visits. Late items are marked; "N follow-ups missed before this" links to the list. Click opens the lead. **Move** reschedules in place (day + time). Owner/PM can see everyone or one person; SALES sees their own. Each kind is capped at 500 and the page says so. The old appointment calendar moved to `/studio/calendar/appointments` (still behind its feature flag; closed to SALES) |
| **Tasks** (`StudioTask`) | `task-rules.ts` (pure), `tasks.ts`, `app/studio/tasks-actions.ts`. Create / edit / done / delete from the calendar ("+ Task", Edit, tick) and from the lead page (`clients/[id]/LeadTasks.tsx`, rendered from `page.tsx` — not SalesPanels). Today has a **Tasks due** section with a Done button |
| **Today stays fast** | `today.ts`: each section is its own query, first 25 rows only. The real size comes from SQL counts (`buildToday totals`), and each section has a "See them all" link (`SEE_ALL`) to the filtered list. Before this, Today read the 600 most recently touched leads, which missed most leads at Hauspire's size |
| **Old dashboard (now "Overview", `/studio`)** | Waiting-on-you / quiet / pool are now counted in SQL (`leads-list.ts dueSnapshot`) and show the first 6 rows. `team.ts myTeam` now uses `groupBy` instead of reading every open lead. The pool page redirects to the list (pool filter, oldest first) |
| **Retractable sidebar** | `StudioShell.tsx`: on a laptop a toggle folds the menu to a 64px icon strip. Labels become tooltips and `aria-label`s, a count becomes a dot, and sub-tabs / search / footer are hidden. The choice is saved in `localStorage` (`studio.rail.collapsed`, try/catch) and read after the first paint. The phone menu is unchanged |
| **Salespeople and the pool** (owner decision, 12 Oct, after AxLeads) | New action `lead.claim` (owner, PM, SALES) in `roles.ts`. New `poolVisibleTo` (unassigned leads in the studio). `LeadScope.pool` / `mayClaim`. With `owner=pool`, a salesperson's list shows the pool with **Claim** on each row and bulk Claim (selected / first 100 / 500 / 1,000 / all). A claim only takes leads still unassigned at that moment (two people can't claim the same lead). The pool lead's page opens only once it is theirs. Any other `owner` value reads as their own leads, so never a colleague's. Today shows them "In the pool — claim one", and the dashboard shows the pool count. Rail: My leads > Pool. Role card text updated |

## Indexes (`studio_clients`)

Added: `(studioId, createdAt)`, `(studioId, nextActionOn)`, `(studioId, lastContactedAt)`, `(studioId, phone)`, `(studioId, name)`, `(studioId, assignedToId, nextActionOn)`, `(studioId, bookedAt)`, `(stageId)`.
Already there and reused: `(studioId, deletedAt)`, `(studioId, assignedToId, deletedAt)` (this covers the requested `(studioId, deletedAt, assignedToId)` for equality filters), `(studioId, stageId, nextActionOn)`, `(studioId, meetingAt)`.
`studio_tasks`: `(studioId, dueAt)`, `(studioId, assignedToId, dueAt)`, `(leadId, dueAt)`, `(createdById)`, plus RLS enable + force + revoke.
**No pg_trgm:** no migration enables extensions. Search is `ILIKE` on name / society plus `contains` on phone, limited to one studio's rows. At ~26k rows that is a scan in milliseconds. A trigram index is the next step if it gets slow.

## Decisions the brief did not settle

1. **The "Dashboard" name.** The old `/studio` screen was called Dashboard. The new KPI page is `/studio/dashboard` and takes that name; the old screen (inbox, owed to trades, live sites, setup) is now **Overview**. Calendar moved from the "From us" group to the top group.
2. **"Gone quiet"** in the new filters means: spoken to before, and nothing for 7+ days. "Never contacted" is a separate filter, so the two numbers don't overlap. The board's "N gone quiet" tile (`boardCounts`) uses the same rule so its link matches. The old dashboard's "no contact for over a week" banner still adds both (quiet + never).
3. **Overdue tile = missed** (date before today in IST). The list's "Due today or missed" is the Today page's "Calls due".
4. **Conversion** = of the leads added in the range, how many have booked (cohort). It is never rounded to 0% or 100% unless exactly that. **Booked value** = the sales-final totals of the leads booked in the range.
5. **Lost** has no timestamp, so lost and its top reasons are all-time (labelled "in all").
6. **Follow-up dates with no time** are stored at UTC midnight (as before); the calendar places them at 10 am IST. Bulk follow-up with no time stores the same way. If a lead has no next action, a follow-up gives it "Follow up", because the rule is a date and an action, or neither.
7. **Bulk follow-up only touches open leads.** Bulk delete leaves alone any lead with quotations, projects or a booking, and says how many it skipped. Bulk move into a lost column needs a reason.
8. **Who can be given leads** (assign / split / tasks): active owner, PM and salespeople only.
9. **The list hides the sample lead** (counts never include it). The board still shows it, and its column count never shows fewer cards than are drawn.
10. **Today email:** a salesperson's email now also includes the pool section.

## Checks

- `npx vitest run`: 176 files, 2,476 tests, all pass. New: `tests/studio-leads-scale.test.ts` (42) and `tests/studio-leads-axleads.test.ts` (13). Together they cover:
  - India date ranges and URL parsing; filters becoming `where` clauses;
  - SALES scope on every query shape (own / pool / never a colleague);
  - keyset paging, split-evenly maths, bulk rules and fences;
  - task rules, calendar items and windows, dashboard definitions;
  - Today totals / tasks / pool, the screens a salesperson can open, saved views, import pieces;
  - the call clock, the four new outcomes, the stale filter, and custom field filters with "Not set".

  Updated: `studio-roles` (lead.claim row), `studio-sales-roles` (role card), `studio-surfaces` (SALES may open the pool), `view-filters` (views now hold the URL filters).
- `npx tsc --noEmit`: clean (0 errors, including Agent D's files at the time of the run).
- `npx next lint`: no warnings or errors.
- security-invariants, tenant-scope, demo-lead, append-only and migration-names all pass.

## Not done / left out

- **No browser walkthrough.** No dev server or database was used, by instruction.
- **Migration not applied.** Apply it to the local test DB, then production.
- **No in-app WhatsApp inbox** (owner's call). "Open WhatsApp" stays as it is.
- **Board grouping** groups only the cards already loaded; "Show more" brings in the rest. The analytics page (`/studio/clients/analytics`) is unchanged; its "quiet" still includes never-contacted.
- **Bulk actions run in one request.** 26,000 leads is about 26 batches of 1,000. If the hosting time limit is short (Hobby: 10s), split very large actions with "first 1,000".

## The AxLeads items (second pass, 12 Oct 2026)

**Migration:** `prisma/migrations/20261012150000_studio_leads_axleads` adds one enum value, `ALTER TYPE "LostReason" ADD VALUE 'WRONG_NUMBER'`. It has not been applied.

| Item | Where |
|---|---|
| **Filter choices show counts, plus "Not set"** | `leads-list.ts filterFacets`. Each count is worked out in SQL with every *other* current filter applied, so "Facebook (412)" is exactly what picking it would show. Covered: source (`groupBy` source + own name), column (`groupBy` stageId), whose (`groupBy` assignedToId; "Not set — nobody has it (pool)"; a salesperson sees counts for Mine and Pool), and the studio's own **list fields** — up to 5 fields with 20 options each, one count per option plus **Not set** (empty or missing). The custom-field filter in the URL is `cf.<key>=<value>` (or `__none` for Not set), handled in `lead-filters.ts`, kept in saved views, and shown as a chip that removes only that field. The counts appear in `FilterBar.tsx` |
| **Stale-lead review** | Filter `stale=1` ("Needs attention") means: open, no follow-up still ahead, and either no contact for 7+ days or never contacted and added 7+ days ago. On the list/board, `StaleReview.tsx` shows the banner "N leads need attention — no contact in 7+ days" (owner/PM: every lead; SALES: their own). **Review** opens a dialog: the leads longest without a call come first, everything is ticked, "Select all N", untick any, "Show 50 more", "Open as a list". **Snooze 7 days** moves the follow-up to 7 days out at 3:30 pm IST, gives "Follow up" to any lead with no next action, and writes a timeline line. **Mark lost** asks the reason once and moves leads to the first lost column. Both run 200 at a time with progress. Code: `bulk.ts bulkSnooze / bulkMarkLost`, `list-actions.ts`. The once-a-day prompt was skipped, as allowed |
| **Schedule-a-call quick choices** | `studio-sales/call-schedule.ts` (pure): **Later today** = 5:30 pm IST, or two hours from now after 3:30 pm. **Tomorrow** (the default) = next working day (Mon–Sat) at 3:30 pm. **Pick a date & time**. A shared control `app/studio/CallWhen.tsx` shows the actual time on each button. It is used in: the lead page's new **Next step** box (`clients/[id]/NextCall.tsx`, which shows what is due and offers Change / Schedule a call); the call log ("Choose when to call next" overrides the outcome's own time; `logContact` takes `dueAt` and never accepts a time in the past); and the calendar's Move (Later today / Tomorrow buttons) |
| **Call outcomes** | `event-copy.ts` adds **Busy** (id `line_busy`, because `busy` already means "asked to call back"), **Switched off**, **Voicemail** and **Wrong number**. Busy → try again in 2 hours. Switched off → Tomorrow (3:30 pm next working day). Voicemail → 4 pm today, or Later today once it is past 4. Wrong number → follow-up cleared, then the call log asks "Mark this lead lost — wrong number?" (`markLostAction` → `clients.ts markLost`, same path as moving the card). Nothing marks a lead lost unless the person clicks |

Notes:
- `lead-filters.ts` now imports `Prisma` as a value (for `Prisma.AnyNull` in "Not set"). Client components that import it get `@prisma/client`'s browser build. Lint and tsc pass; a `next build` was not run here.
- The board cards' own date-only follow-up field is unchanged. Quick choices are on the lead page, the call log and the calendar.


## The AxLeads look (third pass, 12 Oct 2026)

The owner asked for the Leads tab to look and work exactly like AxLeads': "the dashboard KPIs on the top, then the pipelines, then the filters and everything". I read AxLeads' own code (read-only, `C:\Users\sanya\Downloads\lead-management-main`: `app/(dashboard)/leads/LeadsClient.tsx`, `leads/[id]/LeadDetailClient.tsx`, `pool/PoolClient.tsx`, `lib/leads/list.ts`, `components/ax/ui.tsx`, `app/styles/bridge.css`) and the live walkthrough, then rebuilt the same structure, order, labels and behaviour in our own code. The colours and fonts are still ours.

**Migration:** `prisma/migrations/20261012160000_studio_leads_tags`. It adds `studio_clients.tags TEXT[]` (default empty, GIN index) and an index on `(studioId, updatedAt)` for the "Last active" sort. It has not been applied. `prisma generate` rewrote the client types, but the Windows engine DLL was locked by a running dev server (not mine), so only that file copy failed; the engine version is the same.

### `/studio/clients`, top to bottom (`clients/page.tsx`)

| AxLeads | Ours |
|---|---|
| "Leads" + owner picker (All / My leads / each person) · List \| Board · + Add lead | Same. A salesperson sees "My leads" and a link to the pool instead of the picker (`LeadsControls.tsx OwnerPicker`, `ViewToggle`; `Board.tsx AddLeadButton`) |
| Attention banner "N leads need attention — no contact in 7+ days. Review", and a popup "Later / Review now" | `StaleReview.tsx`. The popup shows once per day per browser; "Later" is remembered for that India day in `localStorage` (inside try/catch). The review dialog is titled "Review stale leads", everything ticked, Select all, Snooze 7d, Mark Lost (n), working 200 at a time |
| Six KPI cards: Total leads (+n today / all time) · Pending (untouched — nothing done) · Callbacks (n overdue) · Tasks (n overdue / to follow up) · Needs action (overdue calls + tasks) · Converted (won deals) | `KpiCards`. The rules are AxLeads' (`lead-filters.ts kpiRules`), mapped onto our tables: a callback is `nextActionOn`; a task is `StudioTask`; Pending is the intake column with no call scheduled, never contacted, no task and no timeline line beyond created/assigned; Converted is a WON or DONE column. Each card is one SQL count against the list's own filters minus the card filter (`leads-list.ts leadKpis`). Clicking a card toggles `?kpi=` for the list and the board alike, and the active card is outlined |
| Filters ▾ (with count) → panel: Stage, Source, Due (Any time / Overdue / Due today / Due this week), Tags (with counts), group-by fields (Society, Possession Month, Wing… with counts and "Not set"), Cold 7d+ (n); saved views as chips (★ default, ×), "Save current view as…" + Save; Clear all / Cancel / Apply | `Toolbar`. Stage, source, due, tags and custom fields can each take several values (`?stage=a,b`, `?tag=x&tag=y`, `?cf.wing=A&cf.wing=B`). Saved views are capped at 5 like AxLeads, are now open to salespeople, and a starred view opens on a bare visit to Leads |
| Today (n) toggle · sort (Most recent, Oldest first, Last active, Next call) | `?kpi=today` (calls or tasks due by tonight, or new today and untouched); sort `newest / oldest / lastactive / followup` |
| Board: every column (won and lost too), scroll bar on top, dot + name + count, lazy cards, drag and drop ("Drop here") | `AxBoard.tsx`: per-column counts from `stageCounts`; the first page of each column comes from the server (`columnPage`); scrolling to the foot of the board loads the next page of every column that has more. Dropping on a lost column asks for the reason |
| Cards: avatar initials, name, "Today", "18d cold", "Overdue 3d" / "Today 3:30 PM" / "Tomorrow" / "15 Thu" / "Oct 30", tags, then source icon · "2BHK · ₹15L" · owner / "Mine" / "Unassigned" | Same. The rules are in `lead-view.ts` (`dueBadge`, `coldLabel`, `cardFacts`) and the pills in `ax-ui.tsx`. Time-based pills render only after mount, so server and browser markup agree |
| List: Lead (avatar, name + badges, phone, tags), Stage (inline dropdown with dots), Created, Property, Budget, three swappable columns (Timeline / Notes / Last active by default; also Created, City, Locality, Source, custom fields), Notes = latest + "+n", note icon, infinite scroll "Loading…" | `AxList.tsx`. The column choice is remembered in this browser. Notes come from the lead's NOTE timeline lines, and the row's note icon adds one. Our selection bar (loaded / first 100 / 500 / 1,000 / all N) and the bulk actions are kept |
| Pool: "N unassigned", All leads, grouping, Select (All N / First 100 / 500 / 1,000), Filters, search, Import CSV; Lead (name, place), Stage, Source, Age, Action; bulk: Assign to… / Take / Delete / Clear (salesperson: Claim selected / Clear) | `/studio/clients/pool` (`pool/page.tsx`, `PoolTable.tsx`, `PoolSearch.tsx`), no longer a redirect. Owner/PM get the assign dropdown on each row; a salesperson gets Claim |

### Lead page (`clients/[id]/page.tsx`, `AxLead.tsx`, `CustomFieldsPanel.tsx`)

- **Header (as AxLeads):** "← Leads"; source chip and tags; **WhatsApp** (opens their own WhatsApp — we send nothing) · **Log call** (menu of every outcome; Wrong number then offers "Mark lost — wrong number") · **Note** · **Tag** · **+ Action** (Schedule a call → the next-call box; Send quotation → a new quotation for this lead; Schedule site visit → the meeting box). Then the name and the phone (tap to call); the **stage dropdown** (a lost column asks why); the **owner chip** (read-only; owner and PM change it in the panel); **Converted** (goes to Record booking when a sales final waits, otherwise explains what Converted needs); **delete** (owner and PM).
- **Left:** tabs **Timeline** (the call log and the history), **Floor plan & quotations** (Phase 1's files, quotations/revisions/sales final and booking panels, untouched — Agent Q's floor-plan auto-build keeps working because `FilesBox`/`QuotesBox` are rendered as they were), **Tasks**; then **Internal notes** with edit and delete (your own; owner and PM any) and "Add internal note".
- **Right:** the Phase 1 details panel, then **More details** (the studio's own fields, pencil to edit); **Follow-up** ("Next call: 14 Oct · 3:02 pm" with a done tick, which clears it and adds a timeline line); the next-call scheduler; **Tags** (add with suggestions, × to remove); **Attribution** (Source); the meeting; who has it.

### Tags

`studio_clients.tags` holds the tags, with rules in `studio-sales/tag-rules.ts`: cleaned, compared without case (the first spelling stays), at most 20 per lead. They are written through `lead-extras.ts` inside the lead scope. The tag filter supports counts and shows tags on cards and rows.

### Hauspire's pipeline as a preset

Settings → Pipeline → **Use the Hauspire pipeline** (`pipeline-preset.ts planPreset`, `stages.ts applyHauspirePipeline`, `settings/pipeline/HauspirePreset.tsx`). It produces: New (intake) · Calling 1–4 · Junk · Effective Lead · Requirement / Floor Plan Pending · Quotation Pending · Quotation Shared · Visit Planned · Office Visit Done · Revised Quotation Pending · Finalisation · Converted (WON) · Future Requirement · Lost (LOST).
- **Matching:** a preset column matches one of ours by name in any case; otherwise New takes over the intake column, Converted the first won column and Lost the first lost column (renamed, leads and all).
- **What happens to the rest:** everything else is added. Nothing is deleted; your other columns keep their place after the preset's.
- **How it is applied:** one transaction, after showing what it will add and rename.

### Checks after this pass

- `npx vitest run`: 177 files, 2,495 tests, all pass. New: `tests/studio-leads-look.test.ts` (19) covers the KPI rules, the card filter and SALES scope, sorts, tags and due buckets, the badges and cold days, the facts line, the swappable columns, the tag rules and the Hauspire preset. The scale and AxLeads tests were updated for list filters and AxLeads' "cold" rule.
- `npx tsc --noEmit`: 0 errors. `npx next lint`: clean.

### Not matched, and why

- **Conversation tab, "Draft a reply with AI", Reactivation (21-day cadence), Send portfolio:** no WhatsApp inbox, by the owner's decision, and nothing automatic.
- **Hot flag, lead score and the Score column:** we keep no lead score.
- **KPI cards:** 11 SQL counts in parallel instead of AxLeads' single `COUNT … FILTER` query. Prisma's typed `where` cannot be shared with raw SQL; the numbers are the same.
- **Tag and group-field counts in the filter panel:** counted over the person's leads with their owner choice, but not narrowed by the other panel filters. Grouping over a JSON field and an array needs raw SQL, and our filter is a Prisma `where`. Source, column and owner counts elsewhere do follow every filter.
- **Page sizes:** 50 per page and per column, where AxLeads uses 200 and 100, so the first board load stays light with 17 columns.
- **Mark Lost:** asks for one reason for the batch; our lost reasons feed the dashboard. AxLeads does not ask.
- **Pool grouping:** shows each value as a chip with its count, and clicking one filters to it before selecting. AxLeads shows grouped rows with a per-group "take a chunk".
- **Lead details:** two panels (Phase 1's details panel, which belongs to Agent Q's SalesPanels file, plus "More details" for custom fields) instead of AxLeads' single panel.
- **Filter state:** lives in the URL rather than `sessionStorage`. The daily popup is once per India day per browser; AxLeads shows it once per sign-in and once per day.
- **Global search:** stays in our left rail, not in a top bar.
- **Colours:** our deep-green palette, with AxLeads' semantic tones (amber cold, red overdue, violet tags) drawn from our warn, bad and tag colours.
