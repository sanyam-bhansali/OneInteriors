# Bring in running projects ("Add an existing project")

**Owner, 15 and 20 Oct 2026.** Projects still in design or already on site come onto the platform
within a week; the team sits with the owner and brings each one in, and the old app's quotations
are moved into the new format. Max plan only. Owner, project manager and designer
(`project.bringIn`); sales, supervisor and accounts cannot.

## The flow (`/studio/projects/bring-in`)

Projects → **Bring in a running project** (also on a designer's Design page). One step per screen:

1. **Client** — pick a lead on the board (the studio's own, not One Interiors', not booked, not in
   the bin), or add one (name, mobile, society/flat, locality, BHK). A new mobile is checked
   against the board like the lead form; a match offers "Use that lead".
2. **Quotation** — either
   - **From the Hauspire quotation app**: search by quotation number or client name (number,
     client, BHK, total before GST, date, sales/design), pick one, see its rooms and lines (lines not
     in the product master are flagged, kept as typed). It comes in exactly as agreed: rooms, lines,
     W × H / sq ft / rft / each, work codes MO-01/NM-01, details and every amount as the agreed
     figure; modular discount %, on-spot discount and its name, fee on/off (7%), GST on/off (18%),
     the quotation date. It becomes our quotation (the app's number when free, else `-H`), sent,
     R1 marked as the **sales final** with the studio's payment stages. If the app has a design-stage
     copy, it comes in as the **Design Final** (`<number>-D`). A difference above ₹2 between our
     total and the app's is shown, never hidden.
   - **Built in our builder**: "Build it in our builder" saves the lead (if new) and opens a new
     quotation in a new tab; "I have built it — show it here" lists the client's quotations. The one
     picked keeps its sales final if it stands; otherwise its current version becomes the next
     revision, marked as the sales final. (Owner and PM; a designer is told to ask them.)

   The total the client pays is shown; the person ticks "This matches what the client signed".
3. **Where it is now** — design / execution / snags / warranty and, for design or execution, the
   last step done (the studio's design steps or execution steps; the handover step itself is the
   Snags phase). Every step up to it is ticked **"Done before joining One Interiors"**
   (`doneSource = BEFORE_JOINING`, no photo — only in this flow); the rest stay open. The plan is
   built with the existing date rules and moved so the first open step is planned for **today**
   (with nothing open, so the last step lands on the handover day). Stages whose steps are all done
   are done. Snags/warranty ask the handover day (the warranty runs from it). Starred milestones
   work as usual.
4. **Payments received** — each of the sales final's stages: amount, date, mode. Recorded with
   `beforeJoining = true`, which reads as the existing **'earlier'** status ("Recorded before
   confirmations started · counts as paid"): no client confirmation for these past payments. Never
   more than a stage is owed; never a future date.
5. **Team** — designer (designer/PM/owner), project manager, supervisor.
6. **Client app** — send the invite now (SMS, email when known; never WhatsApp) or later (the
   project page's invite banner sends it).

Then a summary and **Bring it in**: one transaction
(`src/modules/studio-bring-in/bring-in.ts bringIn`) through the existing modules — the lead, the
quotation and its sales final, the project, plan, locker documents and invite exactly as a booking
(`project/own-project.ts writeOwnProject` → `portal/plan-write.ts createSignedProject`), the steps,
the phase through `project/lifecycle.ts applyPhaseEvent` (design sign-off, provisional handover,
closure fixed, handover signed, as needed), the payments, the team rows, the lead moved to the
first WON column. It shows everywhere a booked project does (Projects, My work, the designer's
tabs, the payments desk, site mode, the client app). Timeline: the lead's line and the project's
event `project.brought_in` say "Brought in from the Hauspire quotation app (Q-2312)"; the project
page shows it under the header; an audit row `project.brought_in`.

## The connector (the owner sets these)

| Env var | What |
|---|---|
| `HAUSPIRE_QUOTES_SUPABASE_URL` | The quotation app's Supabase URL, `https://<project>.supabase.co` |
| `HAUSPIRE_QUOTES_SUPABASE_KEY` | A **read-only** key for its `quotes` table |
| `HAUSPIRE_QUOTES_STUDIO_SLUG` | The one studio that sees the import (Hauspire's slug) |

All three set → that studio sees the import; otherwise the step says "Ask One Interiors to connect
your quotation app" and only the builder path shows. Server-side only (`hauspire-source.ts`), plain
`fetch` to PostgREST (`/rest/v1/quotes`), `GET` only, only the columns needed (search: no lines, no
mobile), search text stripped to letters/digits/space/dot/hyphen, 6-second timeout, no key, URL or
client data ever logged. The mapping is pure (`hauspire-map.ts`, tested with fake rows).

The quotation app's own policy today is `using (true)` for anon: a key that can read is also one
that can write there. Prefer a Postgres role or a Supabase key limited to `select` on `quotes`.

## Rules kept

- Max only (`/studio/projects` is a Max screen; `project.bringIn` is a full-software action).
- Importing the same source row twice uses the quotation already made (`importedFrom` unique per
  studio); a project cannot be started twice on one quotation.
- An imported quotation does not pass the builder's rates gate (it is what the client already
  signed); new quotations still do.
- Normal ticks still need a photo and a sentence; "done before joining" exists only here.

## Data

Migration `20261020100000_bring_in_projects` (expand only; columns on tables that already have RLS):
`ChecklistDoneSource.BEFORE_JOINING`, `home_project_payments.beforeJoining`,
`home_projects.broughtInAt/broughtInFrom`, `studio_quotes.importedFrom/importedAt` (unique with
`studioId`). Applied to the local test DB only.

Tests: `bring-in-hauspire-map`, `bring-in-rules` (incl. the connector with a fake fetch),
`studio-roles`; `bring-in-db.integration` runs against the local test DB only when
`BRING_IN_TEST_DB=1` (both paths, with a local PostgREST stub).
