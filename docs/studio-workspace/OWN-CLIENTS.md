# A studio's own clients — "Start a project"

**Written:** 11 Oct 2026 · **Owner decision (same day):** studios may start
projects for their own clients (people who did not come through One
Interiors) from an accepted quotation, with the plan built exactly as at
signing, and invite the client to the app by phone. Customers never get
WhatsApp.

## The model: a real Introduction, marked as the studio's own

Every read of a customer's project reaches its studio and customer through
`HomeProject.introduction` (≈90 files: customer projection, workspace,
site mode, snags, decisions, payments, reminders, coins, family). Making
`introductionId` optional would have meant touching every one of them, and
every miss is a crash or a tenancy hole. So an own client's project hangs
off an `Introduction` like any other, and nothing that reads a project
changed.

What marks it as not ours:

| Where | What |
|---|---|
| `Introduction.source` | `ONE_INTERIORS` (default, every existing row) or `STUDIO_OWN_CLIENT` |
| `Brief.madeByStudio` | The minimal brief made for an own client who had no account. A customer who already had a brief keeps theirs (one brief per person) |
| `studio/introduction-source.ts` | `INTRODUCED_BY_US` — the `where` fragment for "One Interiors introduced them" |

Left out by the source filter: ops' introductions queue and its badge
(`introduction-ops.ts`), "did this call produce a handoff"
(`introducedBriefIds`), the studio's introduction counts and dashboard
funnel, the analytics journey (also `madeByStudio: false` on the cohort),
the customer's "Your home" introductions and check-ins, "Meet studios" in
Choose & sign, and Coins' referral and society-circle rewards. No
`QuoteDecision` (our win record) is written, and nothing about commission
exists on an introduction today; anything billing adds later must filter on
`INTRODUCED_BY_US`.

The quotation keeps `introductionId = null` — it is the studio's own work,
and the builder's "One Interiors" badge reads that column. The customer can
still open it from the Locker: `finalQuoteView` accepts the signed quote of
a project on their own brief.

## Migration

`prisma/migrations/20261011160000_own_client_projects` — expand-only, not
applied (Sanyam runs `db:deploy`): the `IntroductionSource` enum,
`introductions.source`, `briefs.madeByStudio`, and the
`home_project_invites` table (RLS + REVOKE, an index on each foreign key and
on `userId`). Verified by applying all 74 migrations to PGlite.

## Starting one — `project/own-project.ts` `startOwnProject`

- `project.create` (owner or PM). Supervisors and accounts are refused.
- The quotation must be this studio's, for its own client (no
  `introductionId`/`briefId`, client not `ONE_INTERIORS`), **Sent or Won**,
  priced, and not already started. Sent counts because starting the project
  is the studio saying the client accepted; the same transaction marks it
  Won. Once a project runs on a quotation, Reopen is refused.
- One transaction: the customer's account (found by phone; created as
  `CUSTOMER` otherwise; a STUDIO/OPS/ADMIN or erased number is refused), their
  brief, the own-client introduction (contact released and accepted at
  once), then `portal/plan-write.ts` `createSignedProject` — **the same
  function `signFinalQuote` now calls**: quote → Won, the project with the
  total and payment stages locked, stages and room checklists, materials,
  agreement and quote in the Locker. The PM who started it gets a
  `StudioProjectMember` row. Events `plan.created` and `customer.invited`.
  Plan is Basic; the customer can ask for Assured as usual.
- Limits: one project per customer per studio (an introduction is unique per
  brief and studio). A customer One Interiors already introduced to the
  studio is sent to sign in the app instead.

## The invite

`HomeProjectInvite`: an 8-character code (no 0/O/1/I/L) → `/app/join/<code>`.
The project is already on the account for that number, so **signing in with
the number is all it takes** — in the app or on the website; the link just
gets them there and records `joinedAt` (`customer.joined`). The code is not a
credential (the join page needs the invited number signed in), so it is
stored as is, like family invites, and the studio can show it again.

Delivery (`own-project-invite.ts`, never imports WhatsApp or the studio
sender): **SMS** when `messaging/sms.ts` has a provider (none today), **email**
when the client record has one, and always the link plus the message in
English, Hindi and Marathi on the workspace banner with copy buttons — the
studio's own WhatsApp to its client is the surest route today. "Send a new
link" replaces the code.

## Studio side

- `/studio/projects`: **Start a project** button (owner/PM), and a
  "Your own client" tag on those rows.
- `/studio/projects/start`: pick the quotation (client, number, total, date,
  Sent/Won), start date (today), client's name/mobile/email prefilled from
  the client record; handover days are the studio's whole-home figure,
  changeable. **Start project** opens the workspace.
- Workspace: "Your own client" chip; the invite banner until they join; the
  app chip reads "Invited, not joined yet" → "Customer signed in…" →
  "Customer app connected".
- Quotation page: "Start project" on a Sent/Won own-client quotation, "Open
  the project" once one runs on it.

## For the owner

1. Run `db:deploy` (the migration) and restart the dev server so the Prisma
   engine is regenerated.
2. The client's number reaches us from the studio, not from the client. The
   invite says who started the project and why, but no consent is recorded
   for them before they sign in. Decide whether sign-in should show our
   notice to these customers, and add a line to the studio terms that a
   studio may only add clients who agreed to be invited.
3. An SMS provider (with DLT templates) makes the invite arrive by itself;
   until then it is email or the studio sharing the link.
