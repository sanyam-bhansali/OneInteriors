# AxLeads — live walkthrough (owner account, Hauspire workspace)

Seen in the owner's Chrome on 12 Oct 2026, signed in as the workspace
Owner. Nothing was changed: menus opened and closed, no lead saved, logged,
assigned or deleted. Complements the code inventory in
`AXLEADS-FEATURES.md`. A salesperson walkthrough follows.

Hauspire's live numbers that day: 26,576 leads; 10,312 in the pool;
22,736 with no contact for 7+ days; 113 converted.

## Shell
- Left menu: Leads, Pool, Bin, Analytics, Notifications, Billing, Settings;
  the menu closes (×) and reopens. Workspace name under the logo.
- Top bar: workspace chip, global search ("Search leads, phone, city…"),
  EN / हि language switch, light / dark theme, notifications bell with a
  red dot, account menu.

## Leads (board and list)
- Header: "Leads" + owner picker (My leads, All, then each person),
  List / Board toggle, **+ Add lead**.
- Attention banner: "22,736 leads need attention — no contact in 7+ days"
  → **Review** opens "Review stale leads" (all ticked by default, Select
  all, **Snooze 7d**, **Mark Lost (n)**). A popup also offers "Later /
  Review now".
- KPI cards (clickable filters): **Total leads** (all time), **Pending**
  (untouched — nothing done), **Callbacks** (with overdue count),
  **Tasks** (with overdue count), **Needs action** (overdue calls + tasks),
  **Converted** (won deals).
- **Filters** panel: Stage, Source (Meta Lead Ad, Hosted Form, WhatsApp,
  WhatsApp Ads, Webhook, Google Lead Form, Referral, Manual), Due (Any
  time, Overdue, Due today, Due this week), Tags (with counts), Society,
  Possession Month, Wing, "Cold 7d+ (n)"; **saved views** as chips (star a
  default, delete) and "Save current view as…"; Cancel / Apply.
- **Today (n)** button: leads due today. Sort: Most recent, Oldest first,
  Last active, Next call.
- **Board**: one column per stage with its count (New 14,773 · Calling 1–4
  · Junk · Effective Lead · Requirement / Floor Plan Pending · Quotation
  Pending · Quotation Shared · Visit Planned · Office Visit Done · Revised
  Quotation Pending · Finalisation · Converted · Future Requirement; Lost
  apart). Horizontal scroll bar on top. Cards: avatar initials, name,
  badges "Today 3:30 PM" / "15 Thu" / "Tomorrow" (next call), "18d cold",
  "Overdue 18d", source icon, "2BHK · ₹10L–₹15L", owner or "Unassigned" /
  "Mine".
- **List**: columns Lead (name + phone), Stage (inline dropdown to change),
  Created, Property, Budget, Timeline (sortable), Notes (latest note + "+n"),
  Last active (sortable); a note icon on row hover; next-call badge beside
  the name; **infinite scroll** ("Loading…").

### Second look (12 Oct, salesperson account)
- A popup on opening Leads: "{n} leads need attention — These leads have
  had no contact in 7+ days. Review them to follow up, snooze, or close."
  **Later** / **Review now**.
- **KPI cards are toggle filters**: clicking Callbacks outlines the card and
  filters the board/list to those leads (columns keep their counts for the
  filter); clicking again clears it.
- Board columns are droppable ("Drop here" in an empty column); a column's
  count follows the active filter.
- List: the last three columns are **swappable** — each header (e.g.
  Timeline ▾) opens a picker: Timeline, Notes, Last active, Created, City,
  Locality, Source, Score, and every custom field. Stage is an inline
  dropdown listing every column with its colour dot.

## Lead page
- Back to Leads; source chip (e.g. Manual / Lead Ad); name; phone.
- Buttons: **WhatsApp**, **Log call** (outcomes: Picked up, No answer,
  Busy, Switched off, Voicemail, Wrong number), **Note**, **Tag**,
  **+ Action** (Schedule a call · Send quotation · Send portfolio ·
  Schedule site visit).
- Schedule a call: **Later today** (suggested 17:30 IST or +2h),
  **Tomorrow** (next working day 15:30 IST, default), **Pick a specific
  date & time**.
- Stage dropdown, owner chip, **Converted** button, delete (bin).
- Tabs: **Conversation** (WhatsApp messages; "Draft a reply with AI"),
  **Timeline** (calls with outcome and note, reassignments "from Janaki to
  Mansi", stage changes, notes; "Human" / user badges), **Reactivation**
  (21-day cadence that starts automatically when a lead goes cold).
- Internal notes (edit, delete) and "Add internal note".
- Lead details panel (edit pencil): Name, Email, City, Locality, Budget,
  BHK / Property type, Carpet area, Timeline (months), Society, Possession
  Month, Unit, Original Remarks, Phone No. 2, Tag, Notes, Wing, Area, Flat
  no. **Follow-up**: "Next call: 14 Oct · 3:02 pm" with a done checkbox;
  Created date; **Tags** (add a tag); **Attribution** (Source).

## Pool
- "10,312 unassigned"; toggle **All leads**; grouping (No grouping, by
  society, by possession month, by wing); **Select** (All 10,312, First 100,
  First 500, First 1,000); Filters; search name / area; **Import CSV**.
- Columns: Lead (name, city), Stage, Source, Age, Action (assign dropdown
  per row).
- Bulk bar: "n selected" · **Assign to…** (each person) · **Take** ·
  **Delete** · Clear.

## Bin
- "Deleted leads are kept for 30 days, then permanently erased along with
  their calls, messages and history." Columns: Lead, Source, Deleted,
  Erased (date and days left), Restore, delete forever; checkboxes.

## Analytics
- Range: 7 days, 30 days, All time.
- Cards with change vs previous period: Total leads, Qualified rate,
  Conversion rate, Contacted rate (leads called), Avg. time to first
  contact.
- Leads over time (Captured → Contacted → Converted), Leads by source,
  Pipeline funnel by stage with % and Lost.

## Notifications
- "50 unread", Mark all read; "New lead: {name}" with age.

## Settings
- **Profile**: business name; "New leads go to" (the pool, or one person).
- **Team**: seats (5 / 10); invite by email; a row for Unassigned (n open,
  hot, stale); per person: open, hot, stale, status (Active / Suspended),
  Suspend / Restore / Remove. Salespeople see only leads assigned to them.
- **Fields**: custom fields (BHK / Property type list, Carpet area number,
  Timeline number, Society text, Possession Month date, Unit text, …) with
  **Group by** toggles; remove.
- **Alerts**: owner WhatsApp and alert emails for new-lead and HOT alerts
  (managed by AxGen).
- **Sources**: connected Meta (Instagram / Facebook) page with IG linked,
  Active (managed by AxGen).
- **Pipeline**: stages with reorder arrows, colour swatches, INTAKE tag on
  New, remove.
- **Connect Claude**: coming soon (MCP; Claude only drafts, people send).

## Salesperson view ("Agent" role)
- Menu: **My leads**, Pool, Notifications, Settings. No Bin, Analytics,
  Billing.
- My leads: title "My leads", no owner picker; the same banner ("239 leads
  need attention"), KPI cards scoped to their own leads (Total 251,
  Pending 0, Callbacks 18 overdue, Tasks 0, Needs action 18, Converted 2),
  Filters, Today (18), sort, Board / List, Add lead. Board cards show
  "Mine"; empty columns say "Drop here" (drag to move stage).
- **Pool: visible to salespeople**, with a **Claim** button on every row
  and **Claim selected** for a bulk claim (no Assign to, no Delete).
- Lead page: same buttons (WhatsApp, Log call, Note, Tag, Action), stage
  dropdown, Converted; the owner chip is read-only (they can't reassign);
  no delete.
- Settings: Profile, Alerts, Sources, Connect Claude (no Team, Fields,
  Pipeline).

**Differs from One Interiors' decision (12 Oct):** One Interiors
salespeople see only their own leads and never the pool; the owner or PM
assigns. AxLeads lets salespeople claim from the pool. Owner to confirm
which one the studio software should follow.
