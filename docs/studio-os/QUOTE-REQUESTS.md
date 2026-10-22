# Quotation requests (owner, 22 Oct 2026)

At Hauspire only Swarupa (Sales head) and Khushi (Sales rep) make quotations. When a salesperson **adds a floor plan to a lead**, or presses **Request quotation** on it, a quotation request is made and handed out **in turns** to the people who build quotations: one to Khushi, the next to Swarupa, and so on. Nobody builds the same quotation twice.

Migration `20261022130000_quote_requests` (expand only; **not applied to production**).

## What people see

| Who | Where | What |
|---|---|---|
| Builder (Khushi, Swarupa) | Quotations → **To build** (tab with a count of what is waiting) | Each request: the lead, BHK and area, the society, its floor plans (thumbnails or links), who asked, how long it has waited, the note. **Open and build** lands in the builder on the request's draft (the first quote built from the floor plan; if there is none yet, one is made from the lead and its read plan, as "New quotation" makes it). **Mark done** closes it without sending from here. |
| Builder | Their inbox (push or email when set up) | "A quotation to build: Mehta, Baner". Studio staff only; a customer never hears of a request, and One Interiors never sends a customer WhatsApp. |
| Salesperson | The lead page, above the tabs | "Quotation being built by Khushi (not opened yet)" / "Quotation being built by Khushi" / "Quotation built and sent by Khushi" / "Quotation request cancelled: the lead was lost". **Request quotation** (with an optional note) when there is no open request. Told in their inbox when the quotation was sent. |
| Head (owner, PM, a sales role with "Give leads to people" reaching the lead) | Quotations → To build → **Requests** | Every open request on leads within their reach: who builds it, in turn or handed over, who asked, waiting since; **Hand over** to another builder, **Cancel request**. The rule in one sentence and who is next in turn. Done or cancelled in the last two weeks underneath. The same hand over / cancel on the lead page. |
| Owner or sales admin ("Manage the sales team") | Settings → Team → **Quotations** | **Who builds quotations**: everyone whose sales role has "Builds quotations" (the default), or these people in this order. |

## The turn rule

| Situation | Who gets the next request |
|---|---|
| Studio list empty (default) | Every salesperson whose sales role has `quotes.build`, in the order they joined. A plain owner is **not** in the turns. |
| Studio list set ("Who builds quotations") | The listed people in the listed order. The list may hold salespeople whose role has `quotes.build`, and the owner (this is how an owner who quotes joins). A PM, designer, accounts, supervisor, or a salesperson without the permission cannot be listed. |
| Cursor | `Studio.quoteTurnLastId`: the builder the last request went to in turn. The next goes to the first eligible person **after** them in the order, wrapping round. Never set, or that person is no longer in the order: from the top. |
| Someone suspended, invited and not in yet, or whose role lost the permission | Keeps their place in the order, is skipped. Back again: their turns come back without anyone else's moving. |
| Nobody can build now | The request is made **unassigned**; the lead says so, and a head hands it out from Requests. The cursor does not move. |
| A head hands a request over | Goes to the person picked (status back to "Not opened yet", marked "handed over"). **The cursor does not move**: a reassignment is a head's decision about one request, not a turn, so Khushi does not lose her next turn because one of hers was moved, and Swarupa does not skip one because she was handed an extra. |
| Two floor plans at the same instant | The studio row is locked (`SELECT … FOR UPDATE`) in the transaction that reads the cursor, inserts the request and moves the cursor, so they go to two different people. |
| Over a run | n requests between k builders differ by at most one each (tested). |

## States

| From \ event | start (builder opens) | done (sent, or Mark done) | cancel (head, whoever asked, lost/binned) | reassign (head) | extend (another floor plan) |
|---|---|---|---|---|---|
| OPEN | IN_PROGRESS | DONE | CANCELLED | OPEN | OPEN |
| IN_PROGRESS | IN_PROGRESS | DONE | CANCELLED | OPEN | IN_PROGRESS |
| DONE | refused | refused | refused | refused | refused |
| CANCELLED | refused | refused | refused | refused | refused |

At most **one OPEN or IN_PROGRESS request per lead**: a partial unique index (`studio_quote_requests_one_open_per_lead`, Prisma cannot express it). A second floor plan, or a second press, joins the open request (`fileIds`; the note is kept if the first had none). Two presses at once: the loser hits the index and joins the winner's request.

## Trigger points

| Event | Where |
|---|---|
| Floor plan attached to a lead | `studio-sales/leads.ts attachLeadFile` → `requestForPlan` → `studio-quote/quote-request-store.ts openQuoteRequest` (reason FLOOR_PLAN). Not from the First quote page (`FirstQuote.tsx` passes `quoteRequest: false`: the person adding the plan is building the quotation right then). Not by itself for a One Interiors client (their quotation is the final quote), a booked lead, or a lead already sent a quotation (a new plan is a revision; press Request quotation for a fresh one): `quote-request-rules.ts autoRequestSkip`. |
| Request quotation | Lead page `QuoteRequestBox` → `quotations/requests/actions.ts requestQuotationAction` → `quote-requests.ts requestQuotation` (`lead.edit` on the lead: a salesperson on their own leads, a head within reach, owner, PM) → `openQuoteRequest` (reason REQUESTED). |
| A draft is made for the lead | `studio-quote/quotes.ts createQuote` → `linkDraftToRequest`: the open request without a draft builds on it (the floor plan's auto first quote, "New quotation", the First quote page). |
| The builder opens it | `quote-requests.ts startRequest` → IN_PROGRESS, draft made if missing, redirect to `/studio/quotations/{id}`. |
| The quotation is sent | `studio-quote/quotes.ts setQuoteStatus` (→ ISSUED) and `studio-sales/revisions.ts sendAgain` → `completeRequestForQuote`: DONE with that quotation; whoever asked is told unless they sent it. Whoever sends it, the request closes (the quotation is out). |
| Mark done | `quote-requests.ts finishRequest` (the builder, or a head). |
| Hand over / cancel | `quote-requests.ts reassignRequest` / `cancelRequest`. |
| Lead lost or put in the bin | **Cancelled, with the reason** ("The lead was lost." / "The lead was put in the bin."). Done by `quote-request-store.ts settleStale`, run whenever requests are read (To build, Requests, the lead page) or made, so every way a lead is lost or binned (board, call outcome, bulk, merge, bin) is covered without a hook in each. The To build count never counts a lost or binned lead even before that runs. A lead restored from the bin keeps its cancelled request; press Request quotation again. |

## Access: a builder quotes leads that are not theirs

Khushi (a rep: her own leads only) builds the quotation for Swarupa's lead. `studio/lead-scope.ts` gives a builder (`quote.build`, not already seeing every lead), for the leads with an open request handed to them, and **only for quoting**:

- `requested` / `quoteLeads`: the lead, for `leadForQuote` (createQuote, the First quote page's plans and save, Read rooms).
- `quotes` / `quotesWritable`: that lead's quotations (reading also keeps the ones they finished; changing only while the request is open). Wrapped in `AND` so a caller's own `OR` (a search) can never replace it.
- `mayOnLead(…, 'quote.write', lead)` is true on a lead read with `requestedOfMe`. No other action (`lead.read`, `lead.edit`, calls, assign, sales final) widens, and `leads` (the board, lists, numbers, the lead page) is untouched: the builder sees the lead's name, size and floor plans on To build, not its page.

## Settings: "Who builds quotations"

`Studio.quoteBuilderIds` (empty = everyone whose role builds quotations). Saved by `quote-requests.ts saveBuilders` after `quote-request-rules.ts checkBuilderIds` (on the team, active, a salesperson with `quotes.build` or the owner; at most 20). Who may change it: the owner (`team.manage`) or a sales admin (`team.sales`).

At Hauspire: the built-in **Sales rep** role does not have "Builds quotations" (only Admin and Sales head do). Give Khushi's role the permission on Settings → Team → Roles, or list Khushi and Swarupa under Settings → Team → Quotations (listing needs the permission too).

## Files

| File | What |
|---|---|
| `prisma/migrations/20261022130000_quote_requests/migration.sql` | Enums `QuoteRequestStatus`, `QuoteRequestReason`; table `studio_quote_requests` (+ partial unique index, RLS enable/force, REVOKE); `studios.quoteBuilderIds`, `studios.quoteTurnLastId` |
| `src/modules/studio-quote/quote-request-rules.ts` | Pure: who may build, turn order, cursor, states, reassign check, settings check, auto-request skip, lost/binned, words. Tests: `tests/studio-quote-request-rules.test.ts` |
| `src/modules/studio-quote/quote-request-store.ts` | The writes other modules call: open/extend (locked turn), link draft, complete on send, settle lost/binned, To build count, notify the builder |
| `src/modules/studio-quote/quote-requests.ts` | The screens: To build, Requests overview, lead page state, Request quotation, open, mark done, hand over, cancel, Who builds quotations |
| `src/modules/studio/lead-scope.ts` | `requested`, `quoteLeads`, widened `quotes`/`quotesWritable`, `leadForQuote`, `mayOnLead` `requestedOfMe`. Tests: `tests/studio-quote-request-scope.test.ts` |
| `src/app/studio/quotations/requests/` | `page.tsx` (To build + Requests), `RequestControls.tsx`, `actions.ts` |
| `src/app/studio/clients/[id]/QuoteRequestBox.tsx` | The lead page line and buttons |
| `src/app/studio/settings/team/QuoteBuilders.tsx` | Settings → Team → Quotations |
| `src/modules/studio/apps.ts`, `src/app/studio/ui/StudioFrame.tsx`, `src/app/studio/layout.tsx` | The To build tab (owner, PM, builders, heads) and its count |
| `src/modules/notify/messages.ts` | `quote-request`, `quote-request-done` (studio staff only) |

## Not verified yet

- Not run against a database (the migration is not applied anywhere; no integration test). The partial unique index, the `FOR UPDATE` lock and the P2002 retry are reasoned, not exercised.
- Not clicked through in the browser.
