# Studio OS — Phase 1: Sales, from lead to booked

**For:** Sanyam's go-ahead · **Written:** 12 Oct 2026 ·
**Plan:** https://claude.ai/artifact/MCn3Sx7dC5RwTxAbvyDbjm

Rule for everything below (owner, 12 Oct): **easy, not automatic.** The
software records what people decide and never decides for them. What works
today stays: the floor plan is asked for and sent on WhatsApp; the
salesperson attaches it. Revisions are as many as the client needs; the
salesperson marks which one is the sales final.

## Hauspire's sales process (what Phase 1 must fit)

1. Leads from Instagram, Facebook, website, CSV, One Interiors, referrals,
   walk-ins → one list → a salesperson.
2. First call → ask for the floor plan on WhatsApp → client sends it.
3. First quotation shared (PDF on WhatsApp or a link).
4. Office meeting; any number of revisions.
5. The salesperson marks one revision **Sales final**.
6. Client pays the **booking advance (₹25,000, refundable within 3 days)**,
   recorded by accounts → **Booked**: the project exists, the designer is
   assigned (Phase 2 builds design), the client gets the app.

## What gets built

### 1. One lead record, joined to its quotes and project
- The lead (`StudioClient`) is the hub. A quotation is started **from the
  lead** ("New quotation" on the lead page), so `clientId` is set and name,
  phone, society, BHK are filled in. The quotation builder's "new" screen can
  also pick an existing lead by name or phone, or create one on the spot.
- Booking an own lead runs the existing "Start a project" path
  (`own-project.ts`, `createSignedProject`) from the sales final and stores
  the resulting `introductionId` on the lead, so lead → quote → project is one
  chain. One Interiors leads keep their own signing in the customer app.
- Booked leads move to the studio's first **WON** column by themselves; a
  refunded booking moves them back. Nothing else moves a lead automatically.

### 2. The lead page (the place the salesperson lives)
- Opens from a board card and from search (today neither links).
- Header: name, phone (tap to call; **"Open WhatsApp"** opens the
  salesperson's own WhatsApp chat with the client — we send nothing), source,
  owner, the **Next step** button (Call · Attach floor plan · New quotation ·
  Mark sales final · Record booking).
- Edit details (name, phone, email, society, BHK, budget, source) — today
  impossible after adding.
- **Notes** on the timeline (free text), next to the call outcomes that exist.
- **Floor plan and files:** attach from the phone (the share sheet / file
  picker) or drag in on the laptop; PDF or image; kept on the lead and later
  on the project. Optional button "Read rooms" uses the existing floor-plan
  reader to fill the quote's rooms — never automatic.
- **Meeting:** a date and time on the lead ("Office meeting Sat 11 am"),
  shown on the Today list that day. No calendar system in this phase.
- **Quotations:** every quotation for this lead with its revisions and which
  one is the sales final.
- **Payments:** the booking advance once recorded.

### 3. Quotation revisions and the sales final
- Each time a quotation is **sent** (PDF shared or link), a numbered,
  frozen **revision** is kept: R1, R2, R3… (new `StudioQuoteRevision`: quote,
  number, lines and totals as sent, sent at, by). Drafts in between are not
  revisions, as today (`revision.ts` compares against what the client saw).
- Compare any two revisions (the existing comparison, generalised from "the
  issued copy" to "revision A vs B").
- **Mark as sales final** on a revision (salesperson or owner). It is locked;
  a later change makes a new revision, which can be marked instead (the old
  mark moves, with a timeline entry).
- The sales final carries the **payment schedule** from the studio's
  settings (Hauspire's six by default), editable for this client before it
  is marked.

### 4. Payment schedule settings (Library → Payments)
- Default for Hauspire: Booking advance ₹25,000 (refundable 3 days) · Design
  advance 5% · Design closure 10% · Material procurement 40% · Material
  dispatch 40% · Project handover 5% — percentages of the contract after the
  booking advance; each with "what the client gets in this stage" text.
- Any studio: add, remove, rename; a fixed amount or a %; must total 100%.
- The project's schedule is copied from the sales final at booking (the
  existing `paymentSchedule` keeps summing exactly to the contract).

### 5. Record booking (accounts, owner)
- On the sales final: amount (pre-filled ₹25,000), date, mode (UPI, bank,
  cash, cheque), reference. Creates the project, the payment entry, the app
  invite (SMS or email; never WhatsApp from us) and the timeline entry.
- **Refund within 3 days:** "Refund booking" records the refund, cancels the
  project (kept, marked cancelled, not deleted) and moves the lead back.

### 6. Getting leads in, and to the right person
- Sources: add **Facebook**; the studio can add its own source names.
- Import asks for the source (the code comment says it does; the action
  never passed it) and can map custom fields.
- Website form: duplicate check like manual add; the assigned person (or the
  owner) is told in the inbox and by email.
- **Who gets a new lead** (owner, 12 Oct): every new lead lands in the
  **pool**; the owner or a PM **assigns** it (one or many at once, from the
  pool, the board or the lead). No turn-by-turn. One Interiors leads too.
  The salesperson is told in their inbox and Today when a lead is assigned.

### 7. A Sales role and Today
- New role **SALES**: **only their own leads** (owner, 12 Oct; not the pool,
  not colleagues' leads), the quotations of those leads, lead files.
  No projects, payments or rates beyond what quoting needs. Owner and PM keep
  everything. (DESIGNER comes in Phase 2.)
- Roles become per-action checks for leads (today: all or nothing).
- **Today** (the new landing page for owner and sales): calls due and late,
  floor plans not in yet, meetings today, quotes sent and waiting, bookings
  this week; the owner also sees leads nobody has called. Each row has its
  one button.
- A morning email to each salesperson with their Today list (WhatsApp later,
  when the studio template is approved).

### 8. Fixes from the lead audit (docs: Lead Management Today)
- The bin really erases after 30 days (daily job) — the UI promises it.
- The sample lead is left out of "waiting on you".
- Search and filters on the board: name/phone, source, column, owner.
- `QUOTED` events are written; the board's "₹ quoted" works for own leads.

## Data (expand only; migration not applied to production)
- `StudioClient`: `budgetPaise`, `meetingAt`, `meetingNote`.
- `StudioClientFile` (clientId, kind FLOOR_PLAN|OTHER, storage path, name,
  size, uploadedBy, at) — private bucket, signed links.
- `ClientSource` gains `FACEBOOK`; `StudioLeadSource` for a studio's own names.
- `StudioQuoteRevision` (quoteId, n, lines JSON, totals, sentAt, sentById);
  `StudioQuote.salesFinalRevisionId`.
- `StudioRole` gains `SALES`.
- `Studio.paymentTemplate` (JSON).
- No new payment table: the booking is recorded on the project's existing
  payment ledger (`HomeProjectPayment`), created at booking.

## Not in Phase 1
Design phase (mood board, site visit, 3D, design final), vendors, the full
six-place menu (Today and Leads change now; the rest keeps today's screens),
online payments, WhatsApp sending from us, automatic quote drafting.

## Done when (tried with Hauspire)
The owner assigns a Facebook lead from the pool; the salesperson (who sees
only their own leads) calls it, attaches the floor plan
the client sent on WhatsApp, sends R1 as a PDF, sends R2 and R3 after the
office meeting, marks R3 as sales final; accounts records ₹25,000 → the lead
shows Booked with the project, the six payments and the client's app invite.
The owner's Today shows any lead nobody called.

## Answered by Sanyam, 12 Oct 2026
1. New leads: the pool, assigned by the owner or a PM (no turn-by-turn).
2. A salesperson sees only their own leads.
3. "Open WhatsApp" (the salesperson's own WhatsApp, we send nothing): yes.
