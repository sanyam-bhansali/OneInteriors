# AxLeads: complete feature inventory, and how One Interiors' studio Leads compares

**Written:** 12 Oct 2026 · **Source read:** `C:\Users\sanya\Downloads\lead-management-main\lead-management-main`
(the AxLeads repo, read-only; nothing in it was run) · **Compared against:** this worktree's
`docs/studio-os/PHASE-1-BUILT.md`, `PHASE-1-SALES.md`, `src/modules/studio-practice/**`,
`src/modules/studio-sales/**`, `src/app/studio/clients/**`, `prisma/schema.prisma`.

**How to read this.** Sections 1 to 4 describe AxLeads as its **code** behaves (the code wins over its
own docs where they disagree; disagreements are flagged). "Designed, not built" items from its
`docs/new_spec` and `docs/old_spec` are listed separately in 3.20 so they are not mistaken for
features. Section 5 is the comparison table. No keys or tokens from either repo are copied here.

---

## 1. Overview

### 1.1 What AxLeads is

- A multi-tenant lead-management SaaS sold by Axgen as a **managed service** ("AxLeads ... sold as a
  managed service by Axgen"). It covers the gap between "a lead happened" and "a salesperson is
  talking to a qualified buyer": capture (Meta Lead Ads, Google Lead Forms, hosted forms, paid
  click-to-WhatsApp, generic webhook, CSV/Excel import, manual), score, route, alert the owner, and
  feed outcomes back to Meta/Google so the ad algorithms optimise for lead quality.
- Deliberately **not a full CRM**: no quotes, projects or invoicing for the client's own customers.
- Stack: one Next.js 15 (App Router, React 19) modular monolith; Postgres on Supabase with Row Level
  Security; Supabase Auth; Prisma 6; Vercel (region `bom1`, Mumbai) for app and crons. The BullMQ
  queue/worker layer exists in code but is **parked** (never provisioned; `QUEUE_ENABLED` false
  everywhere); background work runs inline or in Next's `after()`.
- First vertical is interiors (`tenant.vertical` defaults to `"interiors"`), and many interiors
  assumptions are baked in: BHK parsing, possession status in scoring, call reactions like
  "Wants a site visit", "Possession not ready", "Comparing designers".
- UI language: English plus a Hindi toggle (`EN | हि` in the top bar) for static chrome only
  (`lib/i18n.tsx`, `t()`).

### 1.2 Roles and permissions

- Three system roles in a **global, data-driven RBAC matrix** (tables `role`, `permission`,
  `role_permission`, `permission_version`; catalogue in `lib/auth/rbac-catalog.ts`; editable at
  runtime from the operator console's RBAC page; running processes reload within about 5 s of a
  `permission_version` bump). The matrix is global, not per tenant.
- Each grant carries a **data scope**: `ALL` (any lead in the tenant) or `OWN` (only leads assigned
  to the caller).
- 25 permission keys: `LEAD.READ, LEAD.CREATE, LEAD.EDIT, LEAD.STAGE, LEAD.ASSIGN, LEAD.CLAIM,
  LEAD.MERGE, LEAD.DELETE, LEAD.EXPORT, LEAD.MESSAGE, ANALYTICS.VIEW, BILLING.READ,
  ALERT.CONFIG_OWN, PROFILE.EDIT, MCP.TOKEN_MANAGE, MEMBER.MANAGE, PIPELINE.CONFIG, FIELD.CONFIG,
  FORM.CONFIG, TEMPLATE.CONFIG, MESSAGING.CONFIG, CONNECTION.MANAGE, TENANT.PROVISION,
  TENANT.GOLIVE, OPERATOR.CONSOLE`. Their own docs say 11 of the 25 are checked by no code
  (e.g. `LEAD.EXPORT`: there is no export feature).

| Role | Scope summary |
|---|---|
| `PLATFORM_OPERATOR` (Axgen staff) | Everything, ALL scope, plus operator console. Can "act as" a tenant, which renders the tenant app **read-only** with a banner "Viewing {tenant} as operator · read-only · Exit to console". |
| `OWNER` (shown as "Admin") | All lead permissions with ALL scope, analytics, billing, members (salespeople only), pipeline, fields, alerts (own), profile, MCP tokens. |
| `AGENT` (shown as "Sales") | `LEAD.READ/EDIT/STAGE/MESSAGE` = **OWN**; `LEAD.CREATE` = ALL; `LEAD.CLAIM` = OWN; `PROFILE.EDIT`. No assign, merge, delete, analytics, billing, settings beyond profile. |

- **Scope enforcement rules** (`lib/leads/scope.ts`, `lib/leads/filters.ts`):
  - Every mutation runs `assertLeadsInScope`; out-of-scope returns **404, never 403** (a 403 would
    confirm the lead exists). Bulk actions are all-or-nothing: one out-of-scope id fails the batch.
  - An OWN caller asking the list for `assigned=all` or someone else's id is **forced back to their
    own leads** server-side; the single exception is `assigned=unassigned` (the pool), which agents
    may read so they can claim. Reading a pool lead is allowed; writing to one is refused until claimed.
  - Agent-created leads auto-assign to the creator (otherwise they would vanish from the agent's list).
  - Opening a lead you no longer own shows "This lead isn't yours ... Unclaimed leads are in the Pool"
    with buttons "Go to Pool" and "My leads".
- **Seats and plans** (`lib/plans/catalog.ts`): `PRO` = 1 admin + 1 sales (2 humans); `MAX` = 2 admins
  + 10 sales (12). `INVITED` and `ACTIVE` occupy a seat; `SUSPENDED` frees it; at least 1 owner
  always (`MIN_OWNERS = 1`). Per-tenant overrides with no UI: `tenant.limit_overrides`
  (e.g. `{"SEATS.AGENT": 15}`) and `tenant.feature_overrides`; cached 30 s.
  Errors: `409 seat_limit_reached:<KEY>`, `409 last_owner_protected`,
  `403 feature_not_in_plan:<KEY>`, `403 missing_permission:<KEY>`.
- **Plan features**: PRO has 27 declared keys (only `TEAM.SELF_SERVE` and `FIELDS.CUSTOM` enforced);
  MAX adds `LEADS.GROUPING` (max **7** groupable fields, `MAX_GROUPABLE_FIELDS`).
- **Who manages whom**: clients invite and manage **salespeople only**; admins are managed by Axgen
  (`403 admin_managed_by_operator`). Removing a member is a **hard delete** of the membership and the
  Supabase auth user; suspension is the reversible state. Removing **or suspending** a member returns
  their open leads to the pool in the same transaction.

### 1.3 Multi-tenancy

- Every domain table carries `tenant_id`; every access goes through `withTenant(tenantId, tx => ...)`
  and Postgres RLS (`app_user`, a `NOBYPASSRLS` role) is the second wall. Policies are declared in
  `prisma/apply-rls.ts`; `tests/rls-matrix.test.ts` asserts every tenant table is protected and no
  tenant reads another's rows.
- One workspace per login (partial unique index `uq_membership_user_active`).
- A paused tenant (not live) sees "Workspace paused ... contact your account manager"; outbound
  messages for paused tenants are skipped.
- Cross-tenant tables with no RLS by design: `webhook_event`, `failed_job` (holds raw provider
  payloads, operator-only), `operator_audit`, `rate_limit`.

### 1.4 Main navigation (tenant app, dark left rail + top bar)

Rail, section "Workspace":
1. **Leads** ("My leads" for an agent) → `/leads`
2. **Pool** → `/pool` (both roles)
3. **Bin** → `/bin` (only with `LEAD.DELETE`)
4. **Analytics** → `/analytics` (only with `ANALYTICS.VIEW`)
5. **Notifications** → `/notifications`
6. **Billing** → `/billing` (only with `BILLING.READ`)
7. **Settings** → `/settings`
8. User menu at the bottom: Settings, Connect Claude, Sign out (sign-out clears the remembered
   leads filter view so the next login lands on the default saved filter).

Top bar: hamburger (opens mobile drawer and collapses the desktop rail; collapse remembered in
`localStorage ax_nav_collapsed`), workspace name chip, **global search** "Search leads, phone, city…"
(submits to `/leads?q=` and keeps the current `assigned=` audience), language toggle EN/हि, light/dark
theme toggle, notification bell with red unread dot and a dropdown panel ("Mark all read", "You are
all caught up"), avatar menu.

Operator console (`/admin`): tenants list (Live/Paused/Setup, ad-lead vs all-lead counts), tenant
detail (profile, plan & entitlements, owners & team incl. "Hand this workspace to a different admin",
lead routing, connections: "Connect with Facebook" page picker, Google Lead Form, webhook source with
"Regenerate" key, hosted forms editor, pipeline editor, alert recipients with "Send test", Meta CAPI
card, Google Ads card, activity/audit, "Go live"), billing (invoices, installments, mark paid, send
invoice by WhatsApp template, A4 invoice HTML/PDF), shared WhatsApp inbox (with media), WhatsApp
usage, failed jobs (with retry for `meta-ingest`/`google-ingest`), RBAC matrix editor, cross-tenant
lead overlap, Meta ad-account health (low balance < ₹500).

---

## 2. Data model (Prisma, `prisma/schema.prisma`)

Conventions: snake_case tables via `@map`; "+core" = `id, tenant_id, created_at, updated_at,
created_by, deleted_at`. 22 hand-written migrations; `db push` and `migrate dev` banned.

### 2.1 Enums that matter for leads

| Enum | Values |
|---|---|
| `LeadSource` | `META_LEAD_AD, HOSTED_FORM, WHATSAPP_INBOUND, GENERIC_WEBHOOK, GOOGLE_LEAD_FORM, WHATSAPP_ADS` (paid click-to-WhatsApp, detected from the message's `referral.source_type = "ad"`), `REFERRAL` (word of mouth), `MANUAL` (hand entry **and** every CSV/XLSX import) |
| `StageSemantic` | `INTAKE, ACTIVE, FOLLOWUP, WON, LOST` (the pipeline's meaning layer; names are free) |
| `FieldType` | `TEXT, PHONE, EMAIL, NUMBER, SELECT, DATE, TEXTAREA` |
| `LeadActivityKind` | `LEAD_CREATED, MESSAGE_IN, MESSAGE_OUT, STAGE_CHANGED, SCORE_UPDATED, ASSIGNED, NOTE, CALL_LOGGED, COLD_TRIGGER_SENT, COLD_CLOSED, HOT_ALERTED, DUPLICATE_FLAGGED, LOST, REOPENED, AGENT_CLAIMED, AGENT_RELEASED, TAG_ADDED, TAG_REMOVED, DELETED, RESTORED` |
| `ActorKind` | `HUMAN, AGENT` (AI, shown as "Claude"), `SYSTEM` |
| `MemberRole` / `MemberStatus` | `OWNER, AGENT` / `INVITED, ACTIVE, SUSPENDED` |
| `ConnectionProvider` / `ConnectionStatus` | `META_PAGE, WHATSAPP, HOSTED_FORM, GENERIC_WEBHOOK, GOOGLE_LEAD_FORM` / `PENDING, ACTIVE, STALE, DISABLED` |
| `NotificationChannel` | `INAPP, SLACK, EMAIL, WHATSAPP` |
| `ReactivationStatus` | `PENDING, SENT, CANCELLED, FAILED, SKIPPED` |
| `MessageChannel` / `MessageDirection` | `FACEBOOK, WHATSAPP` / `INBOUND, OUTBOUND` |
| `MetaEventStatus` | `PENDING, SENT, FAILED, SKIPPED` (also reused by Google events) |
| `AuditActorKind` | `OPERATOR, MEMBER, SYSTEM` |

### 2.2 `Lead` (table `lead`, "the spine")

| Group | Fields |
|---|---|
| Identity | `id, tenant_id, contact_id` (cross-channel contact), `name, phone VARCHAR(16)` (E.164), `email` |
| Pipeline / ownership | `pipeline_id, stage_id, assigned_to` (**no FK**; null = the pool; validated as an active member on write) |
| Canonical facts | `city, locality, budget_min_inr INT, budget_max_inr INT, timeline_text, requirements TEXT[]` |
| Custom | `custom_fields JSONB` (GIN index `idx_lead_custom_fields_gin`) |
| Tags | `tags TEXT[]` default `{}` (GIN index `idx_lead_tags_gin`); shared across the workspace, max 20 per lead, max 40 chars each |
| Score | `score INT` 0 to 100, `score_breakdown JSONB`, `is_hot BOOL` (forced false today), `hot_alerted_at` |
| Attribution | `source, source_connection_id, source_detail JSONB, leadgen_id` (globally unique, also used for Google lead ids), `gclid, campaign_id, adset_id, ad_id, form_id, concept_id, utm JSONB, referred_by` |
| Follow-up | `next_attempt_at` (scheduled call-back), `next_attempt_done_at` (call-back ticked off), `follow_ups JSONB` = `[{id, label, doneAt, dueAt}]` (to-dos) |
| Reactivation | `reactivation_day, reactivation_stopped, last_inbound_at` |
| Lost / dedupe | `lost_reason, lost_at, possible_duplicate_of` (set on a merged-away lead) |
| +core | `created_at, updated_at, created_by, deleted_at` (bin) |

Indexes: `(tenant_id, stage_id)`, `(tenant_id, assigned_to, stage_id)`,
`(tenant_id, source, created_at DESC)`, `(tenant_id, phone)`, `(tenant_id, score DESC)`,
`(tenant_id, last_inbound_at)`, `(tenant_id, contact_id)`, two GINs above, a partial
`(tenant_id, deleted_at) WHERE deleted_at IS NOT NULL` for the bin, unique `leadgen_id`.

### 2.3 Other lead-related models

| Model | Purpose and key fields |
|---|---|
| `LeadActivity` | The timeline: `lead_id, kind, data JSONB, actor_kind, agent_session_id, created_by, created_at`; index `(lead_id, created_at DESC)`. Notes are `kind = NOTE` with `data.text` (+ `editedAt`). Calls are `CALL_LOGGED` with `data.outcome, note, reactions[], durationMin`. |
| `Message` | WhatsApp/Facebook transcript: `channel, direction, body, media, provider_message_id (unique), template_key, generated_by` (`rules`/`llm*`/`reactivation`), `sent_status`. |
| `Contact` + `ChannelIdentity` | Cross-channel identity: one contact per person, identities `(platform FACEBOOK/WHATSAPP, platform_id)` unique per tenant; leads link to a contact. |
| `Pipeline` / `PipelineStage` | One default pipeline per tenant; stages `name, position (unique per pipeline), semantic, color`. Default set at provisioning: **New** (INTAKE, #3b82f6), **Follow-up** (FOLLOWUP, #14b8a6), **Contacted** (ACTIVE, #f59e0b), **Qualified** (ACTIVE, #a855f7), **Converted** (WON, #22c55e), **Lost** (LOST, #9ca3af). |
| `TenantFieldDef` | Custom field registry: `key` (immutable, slug of label, max 40 chars), `label` (editable), `type, options[], required, scored, groupable, position, deleted_at` (hide, not delete). Reserved keys refused: `id, tenant_id, name, phone, email, city, locality, budget, budget_min_inr, budget_max_inr, source, score, stage, assigned_to, created_at`. |
| `SavedFilter` | Per-user lead-list presets: `user_id, name (unique per user), criteria JSONB, is_default`; **max 5 per user**; name max 60 chars; hard-deleted. |
| `HostedForm` / `FormField` | Public forms `/f/{tenantSlug}/{formSlug}`: `slug, title, thank_you JSON, is_active`; fields map to `canonical_target` (`name/phone/email/city` or `custom:<key>`), `required, position`. |
| `TenantSourceConnection` | One row per source: Meta page (`page_id, ig_account_id, page_access_token_enc, scopes`), WhatsApp (`waba_id, phone_number_id, wa_token_enc`), hosted form, generic webhook (`webhook_secret_enc, field_mapping`), Google; `status, enabled, token_expires_at, last_event_at`. Tokens AES-256-GCM encrypted. |
| `Notification` | `lead_id, kind` (`NEW_LEAD`, `HOT_LEAD`), `channel, payload, status, read_at, sent_at`. |
| `ReactivationSchedule` | The cold-lead ladder: `day, channel, template_key, fire_at, status, sent_at, cancelled_reason`. |
| `WaTemplate` | WhatsApp templates per tenant (`key, category, body, variables, meta_template_name, status`). |
| `MetaEvent` / `GoogleEvent` | Conversion feedback log, one row per (lead, event), dedupe keys `lead_{leadgenId}_{event}` / `lead_{leadId}_{event}`; `status, attempts, response_code, fbtrace_id / request_id, error, payload`. |
| `TenantAudit` | Everything that happens to a workspace: `actor_kind, actor_user_id, actor_label` (email snapshotted), `action, data`. Actions seen: `lead_assigned, lead_claimed, lead_unassigned, leads_assigned/claimed/unassigned, lead_deleted, leads_deleted, lead_restored, leads_restored, leads_purged, leads_purged_now, leads_imported`, member and field changes. |
| `Membership` | `user_id, display_name, email, role, status, invite_token (unique), invite_expires_at` (7 days), `invite_accepted_at, invite_sent_at` (rate-limits self-serve resend), `last_active_at`. |
| `Tenant` | `name, slug, vertical, plan, feature_overrides[], limit_overrides, messaging_mode (RULES/LLM/RULES_LLM_FALLBACK), llm_provider (GROQ/OPENAI/CLAUDE), bot_persona, timezone` ("Asia/Kolkata"), `quiet_hours, alert_config JSON, default_assignee` (null = pool), `retention_days` (null = 30), Meta CAPI and Google Ads settings. |
| `McpToken` / `AgentSession` | Tables for "Connect Claude" via MCP; UI says "Coming soon". |
| `RateLimit` | Fixed-window counters for public endpoints (hashed IP + count). |
| Operator-only | `PlatformOperator, OperatorAudit, OperatorWaMessage, BillingConfig, Invoice, InvoiceInstallment, BillingSettings, OperatorSettings, FailedJob, WebhookEvent`. |

There is **no** tasks table, meetings table (a `meeting` table was built on a branch and dropped
8 Sep 2026), calendar, team/branch table, campaign table, call-recording table or SLA table.

---

## 3. Feature inventory by screen and area

### 3.1 Leads list and board (`/leads`, `app/(dashboard)/leads/LeadsClient.tsx`, 3,173 lines)

**Page header**
- Title "Leads" (owner) or "My leads" (agent).
- **Whose-leads dropdown** (owners only, URL param `assigned`): "My leads", "All" (default), then
  every other assignable member by name, plus a trailing entry for a suspended/removed holder you
  are viewing. No "Unassigned" entry (the pool has its own page). Switching keeps an active search.
- **List | Board** segmented toggle (default **Board**; remembered per user in `sessionStorage`).
- **+ Add lead** button (label hidden on mobile). `?new=1` opens it directly.

**Empty / special states**
- Nothing assigned but the pool has work: "Nothing is assigned to you yet" (or "Nothing is assigned
  to {name} yet"), "{n} leads are waiting in the pool — claim the ones you want to work." (agent) /
  "— assign them to your team, or take them yourself." (owner), button **Go to the pool**.
- No match: "No leads match these filters · Try clearing a filter or widening the search."
- **Aging banner** when cold leads exist: "{n} leads need attention — no contact in 7+ days." with
  **Review**.
- **Aging nudge modal** once per login session and once per calendar day (dismissal stored in
  `sessionStorage ax-aging-shown-session` + `localStorage ax-aging-last-day`): "{n} leads need
  attention · These leads have had no contact in 7+ days. Review them to follow up, snooze, or
  close." Buttons **Later**, **Review now**. Escape closes.

**KPI tiles** (server-counted in one SQL pass with `COUNT(*) FILTER`, IST day boundaries; tiles
ignore the active KPI drill-down so clicking one does not zero the rest; numbers formatted en-IN):

| Tile | Exact definition (`lib/leads/list.ts`) | Clickable filter |
|---|---|---|
| **Total leads** | all leads matching the current filter; sub-line "+{n} today" (created since IST midnight) or "all time" | no |
| **Pending** ("untouched — nothing done") | stage semantic INTAKE **and** no `next_attempt_at` **and** `follow_ups` empty **and** last activity within 2 minutes of creation | `kpi=pending` |
| **Callbacks** ("calls scheduled" / "{n} overdue") | open (not WON/LOST) with `next_attempt_at` set and not done; overdue = due before now | `kpi=callbacks` |
| **Tasks** ("to follow up" / "{n} overdue") | open with at least one follow-up whose `doneAt` is null; overdue = `dueAt` before now | `kpi=tasks` |
| **Needs action** ("overdue calls + tasks") | open and (overdue call-back or overdue task); tile shows overdue calls + overdue tasks | `kpi=needs` |
| **Converted** ("won deals") | stage semantic WON | no |

Also counted: **Today** = (pending call-back due by end of IST today) or (task due by end of today)
or (created today and still untouched); **Stale/Cold** = open, not snoozed into the future, and the
latest of created / last inbound / last activity older than **7 days** (`STALE_DAYS`).

**Toolbar**
- **Filters** button (shows "(n)" active count; primary-coloured when active) opening a panel with a
  full-app blur scrim (click scrim to close). Inside:
  - **Stage** multi-select (coloured dots), "All stages".
  - **Source** multi-select (all 8 sources), "All sources".
  - **Due** multi-select: Overdue · Due today · Due this week ("this week" deliberately includes
    overdue and today; server also supports tomorrow and later).
  - **Tags** multi-select, each option with a server count of what ticking it would return
    (facet counts exclude their own selection).
  - One multi-select **per groupable custom field** (MAX plan), options sorted by count, plus
    "Not set (n)" for leads missing the value; a dimension with no values is hidden.
  - **Cold 7d+ (n)** toggle (only when n > 0).
  - **Saved filters strip**: each preset is a chip; click toggles it on/off (several can be on at
    once; selections union; removing one keeps values another active preset needs); ☆/★ sets or
    unsets **your default view** (setting also applies it and closes the panel); ✕ deletes after
    confirm "Delete the saved filter “{name}”?". Input "Save current view as…" (max 60 chars, Enter
    saves) + **Save**; hidden at 5 presets. Errors: "A filter with that name already exists", "You
    can save up to 5 filters".
  - Footer: **Clear all**, **Cancel**, **Apply**.
- An active **default** preset shows outside as a chip "★ {name} ✕"; ✕ removes it from the view and
  clears it as default.
- **Clear** button when any filter is on.
- **Today (n)** quick button (tooltip "Everything to do today — calls & tasks due/overdue + new
  leads"); toggles `kpi=today`.
- **Sort**: Most recent · Oldest first · Last active (**default**) · Next call (soonest pending
  call-back first, none last). Board columns always sort newest first.
- Filter state persists per user in `sessionStorage ax_leads_filters:{userId}` across opening a lead
  and coming back. Precedence on load: `?filter=hot` deep link → active snapshot → default saved
  preset → everything.
- Search comes from the top bar (`?q=`), and matches name, phone, city, locality, any tag, or any
  custom-field value (ILIKE).

**List view**
- Columns: **Lead** (avatar, name or "Unknown contact", phone in mono or amber "no phone yet", up to
  2 tag chips + "+N" with the rest in a tooltip; status pills: **Today** if created today, else
  **{n}d cold**, due pill **Overdue {n}d / Overdue / Today 3:30 pm / Tomorrow / Tue 14 / 14 Oct**,
  HOT flag), **Stage** (inline picker: click badge → any stage → moves with toast "Moved to {stage}"),
  **Created** (date), **Property** (BHK on line 1, "City · Locality" on line 2), **Budget** (range),
  then **three configurable columns** whose header is a field picker (defaults **Timeline · Notes ·
  Last active**; options Timeline, Notes, Last active, Created, City, Locality, Source, Score, plus
  every custom-field key seen on loaded leads, deduped by normalised key; budget and timeline
  duplicates skipped). The column choice persists with the filter snapshot.
- **Notes column**: note icon button opens the **Quick note** modal without leaving the list;
  shows the newest note text truncated (150 px) and "+N" for more notes.
- Owner cell: inline assign picker (Me / each member / divider / Return to pool); amber
  "Unassigned". Agents get a **Claim** path instead (race-safe; "Someone else just took that lead").
- Row highlight: hot rows, rows created today. Every non-interactive cell is a real link, so
  middle-click, ⌘/Ctrl-click and right-click "Open in new tab" work.
- **Infinite scroll** with an IntersectionObserver sentinel; **keyset pagination** 200 rows per page
  (`LEADS_PAGE_SIZE`, max 500 per request); appended pages deduped by id. Footer "{n} leads" or
  "Loading…".
- **Row virtualisation** (`components/ax/row-window.ts`): fixed row height 57 px, overscan 12, kicks
  in above 200 rows; only visible rows are in the DOM.
- Owner column hides itself when every visible lead is yours.

**Board (kanban) view**
- One column per stage (264 px wide), header = stage colour dot, name, and the **server count**.
- Each column fetches its own cards (100 per fetch, `KANBAN_COLUMN_CARDS`) within the current filter;
  one sentinel under the whole board loads the next batch for every column that still has more.
- Filtering to stages hides the other columns (you cannot drop onto a hidden column).
- **Drag and drop** between columns (HTML5 drag; disabled read-only): the card jumps lanes
  instantly (optimistic), counts move −1/+1, only the source and destination columns refetch after
  the write commits. Failure rolls back with "That lead isn't yours any more — someone reassigned
  it." or "Could not move lead".
- Card: avatar, name, Today / {n}d cold / due pill / HOT; up to 3 tags on their own line; source
  icon, "BHK · budget", and in the All view the owner name or amber "Unassigned". Left border blue
  for today, red for hot. Whole card is a link (new-tab friendly), draggable.
- Empty column shows a dashed "Drop here".
- A horizontal scrollbar is mirrored **above** the columns; the bottom bar shows only when the board
  runs past the fold.

**Add lead modal**
- Fields: Name (required, max 80), Phone with **country-code picker** (required; must match the
  country's national length, e.g. 10 digits for +91; stored E.164), City (max 60), Budget ₹ (digits
  only, max 9 chars, must be positive), then every defined custom field with a typed input (select,
  textarea, date, number, email, tel, text) if the plan allows custom fields.
- **Duplicate check by phone**: "A lead with this phone already exists. Open it or create anyway."
  with **Create anyway**. Toast "Lead added". Escape closes. Source is `MANUAL`.

**Review stale leads modal** (owner triage of 7+ day cold leads)
- Sorted oldest-cold first, **all pre-selected**, "Select all ({n})", each row shows phone, stage,
  "{n}d cold".
- **Snooze 7d** (sets `next_attempt_at` = now + 7 days for up to 200 leads) and **Mark Lost ({n})**
  (confirm "Mark {n} leads as Lost?"; reason `aged_out`; max 200).

**Quick note modal**: textarea "Internal note…", "⌘/Ctrl + Enter to save", **Save note**; the row
updates its note preview and count instantly; toast "Note added".

**Keyboard**: ⌘/Ctrl+Enter saves a quick note; Escape closes every modal; Enter saves a filter
preset name; arrow keys/Enter/Escape in the tag combobox (3.2).

### 3.2 Lead detail (`/leads/{id}`, `LeadDetailClient.tsx`, 2,727 lines)

**Back link** "‹ Leads" returns to the exact previous list view (browser history), else `/leads`.

**Header card**
- Source chip, up to 4 tags (+N overflow).
- Action buttons (hidden when read-only):
  - **WhatsApp**: opens `https://wa.me/{digits}` (desktop app or WhatsApp Web); sends nothing
    itself; only when the phone is usable.
  - **Log call** → outcome menu (see Call logging below).
  - **Note** → scrolls to and focuses the note box.
  - **Tag** → scrolls to and focuses the tag input (which opens suggestions).
  - **+ Action** menu: **Schedule a call** (Later today: 17:30 IST or +2 h, whichever is later ·
    Tomorrow: next working day Mon–Sat at 15:30 IST · Pick a specific date & time) and three
    one-tap tasks **Send quotation · Send portfolio · Schedule site visit** (each due in 24 h;
    duplicates of an open task are skipped). Toasts "Call scheduled" / "Task added".
- Name (19 px), HOT flag; phone as a `tel:` link ("No phone captured yet" in amber if missing),
  email, city + locality.
- Row 2: **Stage menu** (dot + name dropdown), **Owner chip** (amber "Unassigned"), then:
  - if Lost: **Reopen** (back to INTAKE, clears lost reason, re-enables reactivation; toast "Lead
    reopened");
  - else **Qualified** (only if an ACTIVE stage name contains "qualif") and **Converted** (moves to
    the WON stage; fires Meta/Google conversions; toast "Marked as converted");
  - **Delete** (trash icon, needs `LEAD.DELETE`): confirm "Delete this lead? It moves to the Bin and
    can be restored from there until the retention window ends." then back to `/leads`.

**Main column tabs**: **Conversation** (default when messages exist) · **Timeline** · **Reactivation**.
- **Conversation**: WhatsApp/Facebook bubbles grouped under channel dividers, outbound tagged
  `rules / llm / reactivation`, time and send status. Empty: "No conversation yet · Messages from
  WhatsApp will appear here." **Draft a reply with AI** opens a templated draft ("Hi {first name}!
  Thanks for your interest — based on your {BHK} in {city}…") with **Copy draft** ("Draft copied —
  sending is manual"), "Outbound sends require a human tap". Up to 200 messages loaded.
- **Timeline**: last 100 activities, newest first, icon per kind, actor tag (System / Claude /
  the person's name / "Human" for old rows), date and time. Score updates hidden. Assignment lines
  read "Assigned to X", "Reassigned from X to Y", "Returned to pool from X", "Claimed". Call lines
  read "Call — Picked up · Wants a site visit, Interested · 4 min · {note}". Empty: "No activity
  logged".
- **Reactivation**: the 21-day ladder for this lead (Day 01, 02, 04, 07, 10, 14, 21; channel chip,
  template name or "free LLM nudge", status Sent/Skipped/Failed/Cancelled/Pending, "fires {date}").
  Header "21-day Fibonacci cadence", badge "Active · day n of 21" / "Halted" / "Closed"; "Stopped —
  lead replied." Empty: "Not in a reactivation sequence". (The ladder has never run in production.)

**Notes panel** (below the tabs, on every lead): notes oldest first as amber cards "Internal note ·
{author} · {date} · {time} · edited", with **edit** (pencil, inline Save/Cancel) and **delete**
(confirm "Delete this note?"); composer "Add internal note" + **Add note**.

**Right rail panels**
1. **Lead details** (pencil to edit): Name, Email, City, Locality, Budget (min/max ₹), then every
   defined custom field (empty ones shown as "—" when the plan allows custom fields) and every other
   value on the lead (Meta form answers), labels humanised ("area_in_pune" → "Area in Pune",
   "bhk" → "BHK"). Values that are links become buttons: Call (`tel:`), Email (`mailto:`), Open
   WhatsApp, Open Messenger chat, Open on Facebook, Open in Maps, Open booking (Calendly/cal.com),
   View document (Drive/Docs/PDF), Open link (only http/https; javascript:/data: blocked).
   Edit mode: typed inputs for defined fields (key locked), free key/value rows for ad-hoc fields
   with remove ✕, **Add field**, and for owners "**Also add to workspace**" to promote an ad-hoc
   field into Settings › Fields. Validation: min budget ≤ max ("Minimum budget can't be above the
   maximum."); duplicate keys refused ("A field with this key already exists: {key}"); empty defined
   fields are left absent (so "Not set" filters work); untouched values keep their original type.
   Save rescores the lead. Toast "Details updated".
2. **Follow-up**: the scheduled call-back as an amber row "Next call: {date} · {time}" that opens
   the call-outcome menu (wrong number hidden); the task checklist (tick toggles done/undone with
   strike-through; due pill "Due 3:30 pm" / "Overdue"; closed leads grey their tasks); footer
   "Created {date} · last reply {relative}".
3. **Tags**: chips with ✕; combobox "Add a tag…" that opens on focus with the workspace's tags
   most-used first and their counts, filters as you type, "Add “{typed}”" last; ↑/↓ to highlight,
   Enter to add (highlighted suggestion wins), Escape closes; adds via the server, which
   canonicalises spelling (case, spaces and punctuation ignored; adopts the workspace's existing
   spelling). Errors: "This lead already has 20 tags — remove one first.", "A tag is a label, not a
   note — keep it under 40 characters.", "A tag needs at least one letter or number to be findable."
4. **Attribution**: Source, Campaign, Ad set, Ad, Referred by (only when set); UTM chips `key=value`.
5. **Requirements** chips (if any).
6. **Possible duplicates (n)**: other live leads with the same phone (oldest first), each a link,
   with **Merge →** (needs `LEAD.MERGE`).

**Call logging** (the heart of the salesperson's day)
- Outcomes (menu "Call outcome"): **Picked up**, **No answer**, **Busy**, **Switched off**,
  **Voicemail**, **Wrong number**.
- No answer / Busy / Switched off / Voicemail → **Retry modal** "{Outcome} logged · When do you want
  to try again?": Later today (17:30 IST or +2 h) · **Tomorrow** (default; next working day Mon–Sat
  15:30 IST, voicemail 16:00) · Pick a specific date & time · Don't retry — mark Closed Lost (in
  code this only clears the call-back; it does not change stage). Buttons **Schedule retry** /
  **Mark lost**. Closing the modal logs nothing.
- Picked up → **Picked-up modal** "Picked up · log the call": **11 reaction chips** (tap, no
  typing): Interested · Wants a quote / estimate · Wants a site visit · Asked for portfolio · Budget
  too low · Just exploring · Possession not ready · Comparing designers · Already done · Call back
  later · Not interested. Optional **Move to stage** chips (current marked "· now"). **Notes**
  (required only if no reaction is tapped). **Duration (minutes)** 0 to 120. Checkbox "Schedule a
  follow-up call (they asked you to call back)" revealing the three schedule choices. Footer shows
  "Moves to X / Follow-up scheduled / Logs the call · attempt {n+1}". Buttons **Log call** /
  **Log + schedule**.
- Server effects (`logCallAction`): writes `CALL_LOGGED`; moves stage only if one was chosen;
  wrong number or "don't retry" clears the pending call-back; a retry sets `next_attempt_at`;
  picked-up reactions create tasks automatically (Wants a quote → "Send quotation", Asked for
  portfolio → "Send portfolio", Wants a site visit → "Schedule site visit"; each due in 24 h, deduped);
  picked-up without a follow-up clears any pending call-back. Attempt count = number of
  `CALL_LOGGED` rows.
- Closing a lead (WON/LOST) clears the call-back and cancels pending reactivation steps.

**Merge** (`lib/leads/dedupe.ts`): moves every activity, message, reactivation step and
notification from the duplicate onto the surviving lead, soft-deletes the duplicate with
`possible_duplicate_of = survivor` (such rows never appear in the bin and are never purged), logs
`DUPLICATE_FLAGGED {mergedFrom}`, then opens the survivor. Self-merge refused.

### 3.3 Pool (`/pool`, `PoolClient.tsx` + `ImportPanel.tsx`)

- Title "Pool", sub-line "Unassigned leads — nobody is working these yet." (or "Reassign or return
  work to the pool." in All mode).
- **Import CSV** button (owners) toggles the import panel (3.4).
- Big **database count** "{n} unassigned"; **All leads** switch (owners) widens the pool to every
  lead (`?all=1`) for reassignment.
- **Group by** select (MAX plan, groupable fields): "No grouping" or "Group by society" etc. Grouped
  mode shows every group with its **true SQL count**, collapsed; opening a group loads its rows
  (200 per page, **Load more**); "No society" group for blanks.
- **Select menu** (on the toolbar for the whole view, and on each group header): "All {n}" or
  **First 100 / First 500 / First 1,000** (only sizes smaller than the match count; chunks disabled
  in All mode). Selection is **described, not enumerated**: the server resolves the filter, the take
  and up to **200 hand-picked exclusions/inclusions** (`MAX_HAND_PICKED`); bulk bar explains
  "the first 100 in Kalpataru · 3 removed · 2 added" or "everything matching …".
- **Filters** panel (live, no saved views): Stage, Source, Tags, each groupable field (with "No
  {field}"), Clear all, Done.
- **Search** "Search name, area…" (debounced 300 ms): name, city, locality, any custom value,
  phone digits, and owner name.
- Table: checkbox (header box toggles whole view; indeterminate state), Lead (name + area, **phone
  deliberately hidden** in the pool), three **configurable columns** (defaults Stage · Source · Age;
  options Stage, Source, Age, Owner, City, Locality, Budget, each groupable field; remembered in
  `sessionStorage ax_pool_cols_{userId}`), Action column (owner: assignee dropdown incl. Unassigned;
  agent: **Claim** button).
- **Bulk bar** (only once something is selected): "{n} selected", agents **Claim selected**; owners
  **Assign to…** (member list), **Take** (to me), **Return to pool** (only when some selected are
  assigned), **Delete** (to Bin; confirm text names the count and the described set), **Clear**.
  Toasts "{n} assigned · {m} skipped", "None could be updated — they may have just been taken",
  "That is too many leads for one action — narrow the view first."
- Infinite scroll (rootMargin 400 px), footer "{loaded} of {total} loaded".
- Empty: "Nothing in the pool — every lead has an owner."

**Assignment engine** (`lib/leads/assign.ts`, `POST /api/leads/assign`, `/api/leads/{id}/assign`)
- Bulk cap **50,000 ids** per call (`BULK_ASSIGN_MAX`), processed in 5,000-id chunks; one
  transaction; grouped conditional updates (`WHERE assigned_to = <what we read>`) so a concurrent
  change is reported as `assignment_changed` / `already_claimed`, never silently overwritten.
  (Their `PRODUCT.md` still says 100; the code says 50,000.)
- Per-lead result lists `assigned[]` and `skipped[{leadId, reason}]` (`lead_not_found`,
  `already_assigned_to_target`, `already_claimed`, `assignment_changed`).
- Every change writes an `ASSIGNED` timeline row and one `tenant_audit` row per batch.
- **No round-robin, no per-source rules, no capacity caps, no SLA reassignment** (deliberately not
  built). New leads go to `tenant.default_assignee` (Settings › Profile "New leads go to"), else the
  pool; if that person is suspended, new leads fall to the pool; if removed, the setting is cleared.

### 3.4 Import (CSV and Excel, `ImportPanel.tsx`, `app/api/leads/import/route.ts`)

- Header "Import leads from CSV", helper "Imported leads go into the pool unassigned. Nothing is
  saved until you press Import." (or "Every imported lead goes straight to {name}.")
- Accepts `.csv`, `.xlsx`, `.xlsm` (workbook read **in the browser** with `read-excel-file`, first
  sheet; reads the stored cell value so 12-digit phones survive). Legacy `.xls` refused ("Open it in
  Excel and choose File → Save As → .xlsx").
- Limits: **10,000 rows** and **4 MB** per file (`IMPORT_MAX_ROWS`, `IMPORT_MAX_BYTES`).
- Only **phone** is required (dedupe key). Header aliasing (slugified, camelCase split): name
  (full_name, contact_name, lead_name, firm_name, customer_name, client_name, party_name), phone
  (mobile, contact, phone_number, number, mobile_no, contact_no, cell, telephone, tel, whatsapp,
  whatsapp_number, …), email, city (town), locality (area, region), budget_max_inr (budget,
  budget_max), stage (status, pipeline_stage, lead_status, lead_stage, stage_name, pipeline), bhk
  (property_type, config), notes (note, remarks). The tenant's own field labels/keys match **first**.
  Panel shows "Column names we read" and "Capitals, spaces and punctuation are ignored."
- Phone normalisation: 10 digits → +91; 11 starting 0 → +91; 12 starting 91 → +; else must be valid
  E.164. **Excel-mangled numbers** (`9.18E+11`) detected and explained ("Excel has damaged the phone
  column … the missing digits cannot be recovered from this file").
- **Preview = real dry run** (same endpoint, `commit:false`): pills **will import / already exist /
  repeated in file / unusable** "of {n} rows"; "Reading {n} columns: …"; "Columns ignored: Wing,
  Tower, Sr No"; virtualised preview table (row height 37) with status per row and a row-detail
  drawer ("Will be skipped — a lead with this phone already exists in this workspace").
- Controls: **Assign every imported lead to** (default = tenant default assignee; "Nobody — leave in
  the pool") and **Set on every row** (stamp one groupable value, e.g. a society, on the whole file;
  amber with **Apply** until applied, green tick after; the column value wins per row, the stamp
  fills blanks).
- **Grouping value reconciliation**: values are trimmed and space-collapsed; canonically identical
  spellings fold silently into the workspace's existing spelling; near-matches (edit distance ≤ 2,
  values ≥ 5 chars) are shown as "These two look like the same thing. Which spelling should they
  both use?" with **Keep “Kalpataru Sunrise” (37 already · 2 here)** for each side, "or leave them
  separate", and **Undo** after a merge.
- **Stage column**: matched to the tenant's stages ignoring case, spaces and punctuation; unmatched
  values still import into the intake stage and are reported ("Qualified → not a stage here, 84
  rows"); WON/LOST rows get `lost_at`/`reactivation_stopped` set.
- Commit in **1,000-row chunks** by file line number with a progress label "Importing 3000/8000…";
  a failure mid-way says "{n} imported, then it failed. Import the same file again to finish — what
  saved will be skipped as duplicates." Bulk writer: ~6 queries per batch, ~4.7 ms per lead.
- Imported leads: source `MANUAL`, not hot, scored in memory, custom values stored as raw strings,
  **no notifications, no ad-platform sync, no duplicate flagging**, one `leads_imported` audit row
  per commit. Existing phones are skipped (no update-on-duplicate, no undo).
- Known gaps (their docs): no column-mapping UI, cannot import budget_min, requirements, created
  date, per-row owner, tags or UTM; unrecognised columns are dropped unless the field exists first.

### 3.5 Bin (`/bin`, needs `LEAD.DELETE`)

- "Deleted leads are kept for {retentionDays} days, then permanently erased along with their calls,
  messages and history." (default **30**, per-tenant override `retention_days`).
- List (200 shown, "Showing {n} of {total}"), newest deleted first: Lead, Source, Deleted, **Erased**
  ("{n} days left" / "today"), per-row **Restore** and **Delete permanently**; select-all; bulk
  **Restore** and **Delete permanently** (confirm "Permanently erase {n} leads? Their calls,
  messages, timeline and ad-platform events are deleted with them. This cannot be undone by
  anyone." → **Erase permanently**).
- Delete is soft (`deleted_at`), cancels pending reactivation, writes `DELETED`; restore writes
  `RESTORED`; caps 50,000 ids per call; purge deletes activities, messages, reactivation rows,
  Meta/Google events and notifications, then the lead, in 5,000-id chunks.
- Empty: "Nothing in the bin · Leads you delete land here and stay recoverable until their retention
  window ends."

### 3.6 Analytics (`/analytics`, needs `ANALYTICS.VIEW`; agents see "Analytics is available to
workspace admins.")

- Period toggle **7 days · 30 days (default) · All time**; every KPI shows % change vs the previous
  equal period ("vs prev.").
- KPI cards and exact definitions (`lib/analytics/service.ts`, leads created in the period, live only):
  - **Total leads** = count.
  - **Qualified rate** = leads now in an ACTIVE or WON stage ÷ total.
  - **Conversion rate** = leads now in a WON stage ÷ total.
  - **Contacted rate** ("leads called") = leads with at least one `CALL_LOGGED` ÷ total.
  - **Avg. time to first contact** = mean minutes from creation to first `CALL_LOGGED`, shown as
    min / h / d (lower is better).
- **Leads over time** chart: per day, Captured (created) → Contacted (first call that day) →
  Converted (first move into a WON stage that day); up to 120 days; stage activity scan capped at
  50,000 rows.
- **Leads by source** bars. **Pipeline funnel**: each non-lost stage's count with % of the previous
  stage, and **Lost** separately. Score bands (NEW 0–20, INTERESTED 21–40, QUALIFIED 41–64, HOT 65+)
  are computed.
- No per-salesperson report on this page; per-person workload is on Settings › Team (3.8).

### 3.7 Notifications (`/notifications` and the bell)

- In-app `NEW_LEAD` notification for **every captured lead** (not imports); `HOT_LEAD` for hot ones
  (hot is switched off today, so none fire).
- Page: "{n} unread" / "All caught up", **Mark all read**, rows "New lead: {name}" / "{name} — turned
  hot" with relative time; click marks read and opens the lead. Empty: "No notifications yet ·
  Hot-lead alerts and new-lead pings will show up here."
- The bell loads once on mount and on opening (the old 20-second poll was removed); panels revalidate
  on tab focus (`useRevalidate`, never polls hidden tabs).
- **Owner WhatsApp alert** on every new lead (`alert_config.newLead.ownerWhatsApp`), using an approved
  template (`leads_notification_global`: header = business name; body = name, phone, one details line
  "📍 Area | *BHK:* 3BHK | 💰 ₹20L–₹30L", up to 4 custom answers) or free text inside the 24 h window;
  optional email recipients. HOT alert path (in-app + Slack webhook + email + WhatsApp, debounced by
  `hot_alerted_at`) exists but is inert.
- Alert recipients are read-only for clients (Settings › Alerts: "Managed by AxGen").

### 3.8 Settings (`/settings?tab=`)

- **Profile**: Business name; **New leads go to** (owner): "The pool — nobody, until someone takes
  them" or a member, with explanation "Leads already captured are not moved."
- **Team** (owner): "Sales team" with seats used "{n}/{max} seats"; invite by email (creates an
  AGENT; 7-day single-use link; existing accounts sign in with their password; resend rate-limited);
  per member **workload counts**: open (not lost), hot, stale (no update for over a day) with
  **Open their leads** link (`/leads?assigned={id}`); pool count "Nobody is working these — open the
  pool to hand them out." / "Every lead has an owner."; **Suspend / Restore**, **Remove** ("This
  deletes their login entirely…"). Admins section read-only ("Managed by AxGen").
- **Fields** (owner, plan `FIELDS.CUSTOM`): "Custom fields · Extra details captured on every lead,
  beyond name, phone, city and budget." Add field (name, type: text, long text, number, date, email,
  phone, pick from a list with comma-separated options), "Saved as {key} — this never changes, but
  the name above can.", rename, **Hide this field** (values kept; "Restore"), **Group leads by this
  field** toggle (MAX only, max 7; "Grouping slices the pool — assign every lead in one society to
  one person in a couple of clicks.").
- **Alerts**: owner WhatsApp and alert emails (read-only).
- **Sources**: list of connected sources with provider, page id, "IG linked", status badge; "Managed
  by AxGen".
- **Pipeline** (owner): add stage (always ACTIVE semantic), rename, recolour, move up/down,
  delete ("Reserved stages (intake / won / lost) can't be deleted. Removing a stage moves its leads to
  the intake stage."; each moved lead gets a `STAGE_CHANGED {reason: stage_removed}` row).
- **Connect Claude**: "Coming soon" (MCP access; "Outbound sends always require a human tap").

### 3.9 Lead capture integrations

| Source | How it works |
|---|---|
| **Meta Lead Ads** | Operator connects a Facebook Page via OAuth ("Connect with Facebook" → page picker, conflict "already connected elsewhere"). Webhook `/api/webhooks/meta`: verify `X-Hub-Signature-256`, claim the event in `webhook_event` (stale claims reclaimable after 10 min), return 200 in under 5 s, then in `after()` fetch the lead from Graph v21.0 with the page token and create it; confirm (`markProcessed`) or release with reason (`failWebhookEvent`) and park the payload in `failed_job` for operator retry. Field mapping: BHK from property_type/bhk/configuration ("3BHK"/"Villa"); budget from budget/price/amount (lakh/crore aware) into min/max + `budget_range`; timeline (ASAP=1, "N months", Diwali=3) into `timeline_months`; carpet area; city (from a city question or a known-city match: Pune, Mumbai, Bangalore, Delhi, Hyderabad, Chennai, Kolkata, Noida, Gurgaon, Thane, Nagpur); everything else kept verbatim. Campaign/adset/ad ids stored. Dedupe on `leadgen_id`. |
| **Google Lead Form** | Per-connection webhook `/api/webhooks/google/{connectionId}` with a per-connection key; columns FULL_NAME, FIRST/LAST_NAME, EMAIL, PHONE_NUMBER, CITY mapped, others kept as custom; `gcl_id` stored; dedupe on `google_lead_id`. |
| **Hosted forms** | Public page `/f/{tenantSlug}/{formSlug}`; honeypot field `_hp`; rate limits **10 submissions per IP per 10 min** and **300 per form per hour**; required fields, E.164 phone check, length caps (name 200, email 254, city 120, others 4,000); UTM captured (max 12 keys, key 40 / value 200 chars); thank-you message; lead created inline, alerts deferred to `after()`. |
| **WhatsApp inbound** | `/api/webhooks/whatsapp`: a message from a known lead's phone appends to the conversation, sets `last_inbound_at`, stops reactivation, and records paid ad touches; a **new** number creates a lead **only if** the message carries a click-to-WhatsApp ad referral (`WHATSAPP_ADS`, with ad id, ctwa_clid, headline, UTM `whatsapp/ctwa/{adId}`). Organic new numbers are not captured. Nothing ever auto-replies. |
| **Generic webhook** | `/api/webhooks/in/{connectionId}` with a signed secret and a per-connection field mapping (`name/phone/email/city` or `custom:<key>`; `_`-prefixed keys kept as detail). Built, unused by any tenant. |
| **Manual** | Add lead modal (3.1), duplicate check, `createManual`. |
| **CSV / Excel** | 3.4. |

### 3.10 Ad-platform feedback (conversions)

- **Meta Conversions API** (`lib/meta/capi.ts`): on every stage change of a Meta-sourced lead, sends a
  CRM event: INTAKE → `Lead`, ACTIVE named qualif/interest → `Interested`, ACTIVE named
  demo/meeting/site visit → `DemoCompleted`, other ACTIVE → `Contacted`, WON → `Purchase` (value =
  budget max, INR), LOST → `LeadLost`. Hashed email/phone, `lead_id`, `action_source:
  system_generated`, deduped per (lead, event), logged in `meta_event`; best effort, never blocks.
- **Google Ads Enhanced Conversions for Leads**: on WON only, uploads a click conversion with hashed
  identifiers and gclid; logged in `google_event`. (Their docs: Google credentials not set in
  production.)
- Operator-side Meta ad-account **low-balance alert** (< ₹500) in the daily digest.

### 3.11 WhatsApp, calls, email

- WhatsApp outbound exists only for owner alerts, operator digest and invoices; per-lead
  conversation sending from the UI does **not** exist (the "Draft a reply with AI" box copies text).
  Per-lead "WhatsApp" button opens `wa.me`.
- **Telephony**: no dialler, no call recording, no IVR; `tel:` links and manual call logging only
  (outbound calling is a v2 design, 3.20).
- **Email**: Resend for invites; optional alert emails. No email to leads.

### 3.12 Scoring

Deterministic, transparent rule table (`lib/leads/scoring.ts`), clamped 0 to 100, stored with a
breakdown and recomputed on every edit:
`new_possession +20, possession_handover/under_construction +25, has_city +15, has_bhk +10,
has_area +10, timeline ≤3 mo +30, timeline 3–6 mo +15, full_home +20, budget_shared +25,
budget > ₹15 L +20, just_browsing −15, no_timeline_after_tries −10, one_word_answers −10`.
HOT threshold 65 but **HOT flagging is switched off** (`isHot = false`). Score is shown as a list
column option; the timeline hides score updates.

### 3.13 Duplicates and identity

- Phone-exact duplicate check on manual add (409 with link, or "Create anyway").
- Lead page lists phone duplicates with **Merge →**.
- Imports skip phones that already exist (and repeated phones within the file).
- Cross-channel `Contact`/`ChannelIdentity` links a person's leads across sources.
- Operator "lead overlap" report finds the same person across tenants.

### 3.14 Audit and history

- Per lead: `lead_activity` (every create, stage change, assignment with from/to and whether it was a
  claim/import/auto, note, call, tag add/remove, lost, reopened, merge, delete, restore).
- Per workspace: `tenant_audit` with actor email snapshot (survives member deletion).
- Operator: `operator_audit` (every operator write is written to both).

### 3.15 Performance and scale techniques

- **Keyset (cursor) pagination**, never OFFSET: cursor = `{sortValue}|{id}`, with a `~` sentinel for
  the NULLS-LAST tail of the next-call and last-active sorts; ties broken by id (an import stamps
  thousands of rows with the same `created_at`).
- **All KPIs, stage column counts and facet counts in SQL** against one shared `WHERE` builder
  (`leadsWhere`), so a tile, a filter and a badge can never disagree; one query for all 11 KPIs
  using `COUNT(*) FILTER`; facet counts exclude their own selection.
- Per-row flags (`stale, untouched, needsAction, todayWork, closed`) computed by the same SQL and sent
  with the row.
- `LEFT JOIN LATERAL` for last activity (index-only on `lead_activity(lead_id, created_at DESC)`) and
  for latest note + note count.
- "Now", "start/end of today (IST)" and the stale cut-off computed once per request and passed in.
- Row virtualisation in the list (57 px rows), per-column paging on the board, sentinel-based
  infinite scroll, deduping of appended rows, optimistic updates with rollback.
- Filter changes refetch rows **and** counts once (`counts=1`); scrolling fetches rows only.
- GIN indexes on `custom_fields` and `tags`; composite indexes listed in 2.2; pool group-by in SQL
  (`GROUP BY custom_fields->>key`).
- Bulk writes chunked at 5,000 ids; import bulk writer with `createMany`; activities `createMany`
  in 5,000-row chunks.
- Public REST list capped at 500 per call (was 10,000 and became the biggest egress source).
- Webhooks ack in < 5 s; work in `after()`; idempotent claim-then-confirm.

### 3.16 Mobile behaviour

- Responsive web only (no native app). At ≤ 860 px the rail becomes a slide-in drawer, `hide-mobile`
  items (search box, workspace chip, Add-lead label) hide, the lead page's two columns stack; at
  ≤ 640 px secondary table columns (`col-sec`) hide, leaving Lead + Stage, and the notification panel
  goes full width. Note buttons are always visible on touch devices. Call-outcome menu re-positions
  to stay on screen. `tel:` and `wa.me` links make phone use practical.

### 3.17 Billing (tenant side, `/billing`)

Invoices list with status (draft, sent, partially paid, paid, overdue, void), installments, A4 invoice
view, "I've paid" claim with reference (operator confirms).

### 3.18 Settings for automation, and what is NOT automated

Automated today: default assignee on capture; owner WhatsApp/email alert per new lead; in-app
notification; reaction-derived tasks; call-back defaults; Meta/Google conversion feedback; bin purge.
Explicitly not built: round-robin, rules by source, SLA timers/escalation, daily claim caps,
leaderboards, reassignment approvals, auto-replies, lead export.

### 3.19 Hindi

`EN | हि` toggle translates static UI strings (labels, buttons), not data.

### 3.20 Designed but not built (from `docs/new_spec`, v2, Sept 2026)

Recorded so nobody copies them as existing features: unified inbox with an AI conversational
qualifier on WhatsApp; configurable ICP rules engine (spam → hard filters → required fields → fit →
intent → capacity → firm-named tiers; `lib/agent/rules/` has the schema and 24 tests, not wired in);
explainable score; routing and human handoff; consultation booking with meeting types,
availability, reminders, reschedule, no-show (`f07-scheduling.md`); automated follow-up "silence
sequence" that bends to possession date (`f08`); cold-to-hot nurture; manager dashboard; outbound
calling with BYO telephony (Exotel-style); commitments-and-tasks with re-entry prompts and an
escalation ladder; Instagram channel; Meta feedback; onboarding crawler.

---

## 4. Worker and background jobs

| Job | Trigger | What it does | Status |
|---|---|---|---|
| `keep-warm` cron | Vercel `0 0 * * *` (05:30 IST daily) | Pings the database | Live |
| `daily-digest` cron | Vercel `30 15 * * *` (21:00 IST) | If enabled in operator settings: WhatsApp to Axgen staff listing each live tenant's leads today ("⚠️ Zero today" first, then "✅ Active", total), plus Meta ad accounts under ₹500; records `sent / window_closed / no_recipient / error` | Live (staff only, not salespeople) |
| `purge-leads` cron | Vercel `20 19 * * *` (00:50 IST) | Erases bin leads older than the tenant's retention (30 days default) in batches of 2,000, across tenants, with a `leads_purged` audit row per tenant | Live |
| Cron auth | all three | `Authorization: Bearer CRON_SECRET`, timing-safe compare; production refuses to boot without the secret | Live |
| Webhook post-processing | Meta/Google/WhatsApp/form | `after()` inline work, claim/confirm/release, `failed_job` on error, operator retry | Live |
| `notify` / `wa-send` dispatch | on capture | `dispatchNotify` / `dispatchWaSend` run **inline** because the queue is off; skip paused tenants | Live inline |
| BullMQ queues `lead-ingest` (6), `wa-send` (8, 5 retries), `cold-trigger` (4), `notify` (8) | Redis | 3 attempts, exponential back-off 1 s, keep 1,000 completed / 5,000 failed | **Parked**, never run |
| `worker/main.ts` | long-running process | Registers the 4 workers, 30 s heartbeat, reactivation tick every 60 s | **Parked** |
| Reactivation tick | worker interval | Leads silent for 12 h after an inbound reply get the 1·2·4·7·10·14·21-day WhatsApp ladder (templates revive_soft, revive_social_proof, revive_incentive or revive_objection_price on day 4, revive_final; day 21 = mark Lost "cold_closed"); a reply stops it | **Never run** |

---

## 5. Comparison: AxLeads vs One Interiors studio Leads (as of 12 Oct 2026)

**One Interiors today** means committed code on this branch (`6d8a15d`, Studio OS Phase 1): the
board at `/studio/clients` (client-side filters over the first **400** leads, `myClients take: 400`),
lead page with SalesPanels, pool, bin, import, analytics, saved views (max 12), duplicates/merge,
website capture form, Today page and morning email, SALES role with own-leads scope.
**In progress (uncommitted, another build; LEADS-SCALE-BUILT.md not yet written):** migration
`20261012120000_studio_leads_scale` (8 new indexes on `studio_clients` + `studio_tasks` table),
`studio-sales/lead-filters.ts` (filters: q, source, stage, kind, owner, due today/missed/due/upcoming/
none, never contacted, gone quiet, lost reason, date ranges for added/contacted/meeting/quoted/
sales final/booked; sorts newest, oldest, follow-up date, longest since a call, name),
`bulk-rules.ts` (Give to one person · **Split evenly** · Move to a column · Set a follow-up date ·
Delete; max 30,000, chunks of 1,000), `task-rules.ts` (tasks with title 2–140 chars, due day/time,
default 10:00, assignee), `ist-range.ts` (Today, Yesterday, Last 7/30 days, This week/month, custom
range). Rows marked "partly (in progress)" depend on that build landing.

Priority is for a Pune interior studio with **26,000 leads (adding 700–800 a day) and 4
salespeople**: **must** = needed to work the list daily without losing leads; **should** = clear
productivity win; **later** = nice, or only matters with ad spend/scale we do not yet have.

| # | AxLeads feature | One Interiors today | Gap | Priority | Notes |
|---|---|---|---|---|---|
| 1 | Paginated **list view** (keyset, 200/page, infinite scroll, virtualised rows) | Board only, first 400 leads loaded, filtered in the browser | partly (in progress) | must | At 26k leads anything past 400 is invisible today. Use keyset on (sortKey, id), not OFFSET; imports share one `createdAt`. |
| 2 | **Board with server counts per column** and per-column paging (100 cards, load on scroll) | Board columns built from the 400 loaded rows | missing | must | Column header must show the SQL count, not cards loaded. |
| 3 | **KPI tiles from SQL** (Total, Pending/untouched, Callbacks + overdue, Tasks + overdue, Needs action, Converted, Today, Cold 7d+), each tile a click-filter | NeedsAttention strip + analytics page counts (open, pooled, overdue, quiet, won, lost) | partly (in progress: KPI dashboard) | must | One shared WHERE for tiles, list and badges; tiles ignore their own drill-down; IST day boundaries. |
| 4 | **Today** quick filter (calls/tasks due by end of day + today's untouched new leads) | Today page (calls due/late, meetings, floor plans missing, quotes waiting, bookings, pool, never called) + 08:00 email | have (different shape) | must | OI Today is richer; add a Today toggle on the list too. |
| 5 | Filters: stage, source, due bucket, tags, each groupable field incl. "Not set", cold 7d+, owner; facet counts beside options | Search (name/phone), source, column, owner "Showing"; groupable fields in saved views | partly (in progress) | must | The in-progress filter set (due, never contacted, quiet, lost reason, date ranges) exceeds AxLeads on dates; add facet counts. |
| 6 | Sorts: most recent, oldest, last active (default), next call | Board sorted by follow-up date then updated | partly (in progress) | must | In-progress sorts add name and longest-since-call. Add "last active". |
| 7 | **Saved filter presets** (5/user, default view, several on at once, union) | Saved views (12/member, default) | have | should | Consider allowing combining views. |
| 8 | Filter view remembered per user across opening a lead and back | Not checked in detail | partly | should | sessionStorage snapshot; cleared on sign-out. |
| 9 | **Configurable list columns** (3 slots, any field incl. custom) | none (no list) | missing | should | Comes with the list view. |
| 10 | Inline **stage change** and **owner change** from a list row | Board drag and drop; lead page | partly | should | Row pickers avoid opening 26k leads one by one. |
| 11 | Notes column with latest note preview + "+N", **quick note** modal from the list | Notes on the lead page timeline | missing | should | ⌘/Ctrl+Enter to save. |
| 12 | Drag and drop on board with optimistic hop, rollback, refetch only 2 columns | Drag and drop (`Dnd.tsx`) | have | should | Check it survives server-side column paging. |
| 13 | Board/list cards: Today pill, "{n}d cold", due pill (Overdue nd / Today 3:30 pm / Tomorrow / weekday), HOT, tags, owner | Card shows follow-up date, quoted ₹, "Spoke today/yesterday" | partly | should | Server-computed flags so a pill and a tile agree. |
| 14 | **Pool** with SQL counts, group-by a field with true group counts, **select First 100/500/1,000** or all, hand-picked exclude/include (200), described bulk selection | Pool screen: select all, "Take these"; board "Give the N shown to…" | partly (in progress: bulk split) | must | With 26k leads and 4 people, "give the first 500 of Kalyani Nagar to Priya" is the daily move. |
| 15 | Bulk **assign / take / return to pool / delete**, 50,000 cap, conditional updates, per-lead skipped reasons | `assignClients` many at once; bulk bin | partly (in progress) | must | In-progress adds Split evenly, Move to column, Set follow-up date (AxLeads has none of these three). |
| 16 | Round-robin / automatic routing | Pool + manual assign (owner decision, 12 Oct) | have (by decision) | later | AxLeads also refuses round-robin; Split evenly covers the need. |
| 17 | Default assignee setting ("New leads go to") | Everything lands in the pool; SALES-added stays theirs | partly | later | Useful only for one-person studios. |
| 18 | Claim from pool (race-safe, "already claimed") | SALES cannot see the pool (owner decision) | n/a by decision | later | Keep decision. |
| 19 | **Call logging** with 6 outcomes and retry scheduler (later today 17:30/+2h, tomorrow next working day 15:30, voicemail 16:00, pick time) | Log contact: 7 outcomes (No answer, Spoke, Asked to call back, Met, Visited site, Messaged, Not interested), each sets a next action with its own due time | have (different) | must | OI's outcome → next action is already better; add the time-of-day defaults and working-days skip. |
| 20 | Picked-up modal: **11 reaction chips**, optional stage, duration (0–120 min), follow-up toggle, attempt number | Outcome + note | partly | should | Reactions like "Wants a quote", "Possession not ready", "Comparing designers" make reporting possible. |
| 21 | Reactions auto-create tasks (quote, portfolio, site visit, 24 h) | Outcome sets `nextAction` + `nextActionOn` (one slot) | partly | should | One next-action slot vs a task checklist; `studio_tasks` (in progress) can carry several. |
| 22 | **Follow-up tasks** checklist per lead with due and overdue | `nextAction` single field; `StudioTask` table in progress | partly (in progress) | must | Calendar with tasks is in the other build. |
| 23 | Scheduled **call-back** separate from tasks, tick done | `nextActionOn` doubles as call-back | partly | should | Fine if tasks land. |
| 24 | Action menu: schedule a call, one-tap tasks | Next step button (Call, floor plan, quotation, sales final, booking) | have (different) | should | — |
| 25 | **Calendar** of call-backs/tasks/meetings | None (meeting date on lead, shown on Today) | missing (in progress) | must | AxLeads has no calendar either; OI is ahead once built. |
| 26 | Lead page: header actions WhatsApp (wa.me), Log call, Note, Tag, Action | Call, Open WhatsApp, edit, notes, files, meeting, quotations, booking | have | must | — |
| 27 | Notes: author, edit, delete, "edited" mark | Notes on timeline + `notes` text column | partly | should | Edit/delete own notes. |
| 28 | Timeline of every event with actor names (assign from/to, calls with reactions, tags) | `StudioClientEvent` with summary written at the time, byName kept | have | must | — |
| 29 | **Tags** (shared, 20/lead, 40 chars, canonical spelling, autocomplete with counts, tag filter with counts) | None | missing | should | Cheap and high value: "NRI", "site visit Sunday", "possession Dec". |
| 30 | **Custom fields** (7 types, required, hide not delete, immutable key, reserved keys, promote ad-hoc field from a lead) | Fields: TEXT/NUMBER/DATE/SELECT, groupBy, rename, remove | have | should | Add hide-not-delete and promote-from-lead. |
| 31 | **Group by a field** (society) with SQL counts, max 7 | `groupBy` flag on fields, used in saved views | partly | must | Society grouping is the Pune use case; needs SQL counts at 26k. |
| 32 | Dynamic display of Meta form answers, link values become buttons (Maps, Drive, wa.me…) | Fields shown as stored | partly | later | — |
| 33 | **Scoring** (13 rules) and HOT alerts | None (deliberately, `analytics.ts` comment) | missing by decision | later | AxLeads computes it but HOT is off; revisit only if ad leads flood in. |
| 34 | Duplicate check on manual add with "Create anyway" | Duplicate check on add and website form | have | must | — |
| 35 | Duplicates panel + **merge** (moves history, keeps a pointer) | Duplicates panel + merge with `mergedIntoId`, undoable | have | should | OI is ahead (undo). |
| 36 | **Import CSV/XLSX**: 10,000 rows / 4 MB, phone required, alias table, browser XLSX read, Excel-mangled phone detection, dry-run preview with 4 buckets, row detail, stamp a society on every row, spelling reconciliation, stage column, 1,000-row chunked commit with progress and safe re-run | CSV only, 5,000 rows, ~900 KB text, **mapping screen** (shows first rows), source chosen, custom columns, `looksDestroyed` phone check, dedupe incl. deleted | partly (in progress: 26k import) | must | Add XLSX, chunked commit with progress, stage column, society stamp, re-run-safe. OI's mapping screen beats AxLeads' alias-only approach. |
| 37 | Import assigns all to one person or the pool | Import lands in the pool | partly | should | Add "Assign every imported lead to". |
| 38 | Import fires no alerts, writes one audit row | Not checked | partly | should | Importing 26k must not email anyone. |
| 39 | **Bin**: 30 days, per-row days left, restore, delete permanently, bulk, purge cron | Bin (`myBin` take 400), restore, erase, purge cron 03:00 IST | have | must | Paginate the bin (400 cap). |
| 40 | Owner triage of **stale leads** (7+ days): review modal, pre-selected, Snooze 7d / Mark Lost (200 max) + daily nudge | "Gone quiet" count (`QUIET_AFTER_DAYS = 7`), filter in progress | partly | should | Bulk "Set follow-up date" (in progress) covers snooze; add Mark lost in bulk with reason. |
| 41 | Lost with reason; Reopen | Lost reasons (7), lost note; move back | have | must | OI reasons are richer. |
| 42 | **Analytics**: 7d/30d/all with deltas vs previous; total, qualified %, conversion %, contacted %, avg time to first contact; captured→contacted→converted per day; by source; funnel with step %, lost | Analytics: total, open, pooled, overdue, quiet, won, lost, new this month, win rate, won value, by stage, by source (with won), lost reasons | partly (in progress: KPI dashboard) | must | Add periods + deltas, **time to first contact**, contacted rate, daily chart. |
| 43 | Per-salesperson workload: open, hot, stale (>1 day no update), "Open their leads" | Owner "Showing" filter; team page | partly | must | 4 salespeople: owner needs per-person open / overdue / called today / converted. AxLeads only has workload, not a leaderboard. |
| 44 | Whose-leads switch (My leads / All / each member) | "Showing" control on board | have | must | — |
| 45 | Roles: OWNER/AGENT with ALL/OWN scope, 404 on out-of-scope, OWN forced server-side | OWNER/PM/SUPERVISOR/ACCOUNTS/SALES/DESIGNER, `lead-scope.ts` | have | must | OI is richer. Make sure out-of-scope returns not-found. |
| 46 | Removing/suspending a member returns their leads to the pool in the same transaction | `onDelete: SetNull` on membership delete | partly | should | Suspension case to check. |
| 47 | Seats and plan limits | Not applicable | n/a | later | — |
| 48 | **Meta Lead Ads** capture (webhook, Graph fetch, field mapping, idempotent, failed-job retry) | None; FACEBOOK source is manual | missing | should | Pune studios run Meta ads; this removes CSV downloads. Needs a Meta app and per-studio page connection. |
| 49 | Google Lead Form webhook | None | missing | later | — |
| 50 | Hosted public form (rate limits 10/IP/10 min, 300/form/hour, honeypot, UTM) | Website capture form (5/address/hour, 300/form/hour), duplicate check, notify | have | must | Add UTM capture. |
| 51 | Click-to-WhatsApp ad leads (`WHATSAPP_ADS`) + WhatsApp inbound conversation | None | missing | later | Needs WhatsApp Business API; owner rule: we never send WhatsApp. |
| 52 | Generic signed webhook with field mapping | None | missing | later | Useful for Housing.com / NoBroker / 99acres feeds. |
| 53 | **New-lead alert** to owner (WhatsApp template / email) + in-app notification per lead | Inbox + email on website lead and on assignment | partly | should | 700–800 a day means a digest, not one ping per lead. |
| 54 | Notification centre (bell, unread dot, mark all read) | Studio inbox | have | should | — |
| 55 | Meta CAPI / Google conversion feedback on stage change | None | missing | later | Only once Meta capture (48) exists. |
| 56 | Attribution panel (campaign, ad set, ad, UTM, referred by) | Source + studio source name + source note | partly | later | Comes with 48/50. |
| 57 | Contact identity across channels | One row per lead | missing | later | — |
| 58 | Audit: per-workspace trail of assigns, imports, deletes, purges with actor email | Timeline per lead; project event log | partly | should | Bulk actions on 26k need a workspace-level record. |
| 59 | Performance: SQL counts, keyset, GIN indexes, LATERAL joins, chunked bulk writes, ack-fast webhooks | Indexes added in progress; no pg_trgm; board client-side | partly (in progress) | must | Index on (studioId, name) won't help `contains` search; consider pg_trgm later. |
| 60 | Mobile: drawer nav, stacked lead page, hidden secondary columns, tel/wa links | Customer app native; studio web responsive; site mode on phone | have | should | Salespeople call from phones: list rows must stay usable at 375 px. |
| 61 | Collapsible sidebar remembered in localStorage | In progress | partly (in progress) | should | — |
| 62 | Global search box in top bar (name, phone, city, tags, custom values) | Board search name/phone; `findClients` (20 results) | partly | must | Search must hit all 26k, not the loaded 400. |
| 63 | Reactivation ladder (21-day WhatsApp) | None | missing (never ran in AxLeads either) | later | Conflicts with "we never send WhatsApp". |
| 64 | AI draft reply (copy only) | None | missing | later | — |
| 65 | Export leads | None (AxLeads has none either) | missing in both | should | A studio with 26k leads will ask for an Excel export; gate to owner. |
| 66 | Hindi UI toggle | English | missing | later | Marathi/Hindi for sales staff could matter. |
| 67 | Quotations, revisions, sales final, booking, payments from the lead | Built (Phase 1) | OI only | — | AxLeads has none; this is OI's edge. |
| 68 | Floor-plan files on the lead, "Read rooms" | Built | OI only | — | — |
| 69 | Sample/demo lead on an empty board | Built | OI only | — | — |

### The must-have gaps in one place

1. A real **list view** over all 26,000 leads: keyset pages of ~200, infinite scroll, virtualised
   rows, configurable columns, inline stage and owner pickers (rows 1, 9, 10).
2. **Counts from the database**: board column totals, KPI tiles and filter counts computed in SQL
   from one shared filter, so nothing describes "the 400 we loaded" (rows 2, 3, 5).
3. **Server-side search and filters** across every lead, including society/group with true counts
   (rows 5, 31, 62).
4. **Bulk work at scale** in the pool: select all / first 100 / 500 / 1,000 of a filtered or grouped
   view, hand-pick exceptions, then assign, split evenly, move, set follow-up or delete, with
   per-lead skip reasons (rows 14, 15).
5. **Tasks and a calendar** so each salesperson's day is a list of due and overdue calls/tasks
   (rows 22, 25), on top of OI's outcome → next-action rule.
6. **Import that copes with 26k**: XLSX, chunked commits with progress, safe re-run, stage column,
   stamp-a-society, assign-on-import, no alert storm (rows 36 to 38).
7. **Analytics a manager can steer by**: periods with deltas, contacted rate, time to first contact,
   daily captured→contacted→converted, per-salesperson numbers (rows 42, 43).
8. A paginated **bin** (row 39) and an owner **stale-lead review** (row 40).
