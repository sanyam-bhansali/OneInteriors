# Moving a studio off AxLeads (the AxLeads import)

**Owner, 21 Oct 2026.** All of Hauspire's AxLeads data comes over: every lead with its form answers,
custom fields, source / campaign / ad, tags, score, budget, city and locality, requirements and
timeline; its stage, its person, its notes; its whole history (calls, stage changes, notes,
assignments, lost reasons, WhatsApp messages) at the original times; and the team.

Two scripts, one in each codebase. The export only reads AxLeads. The import writes to One
Interiors only where you point it, and **sends nothing to anybody** — no invite, no WhatsApp, no SMS.

## Owner steps

### 1. Export from AxLeads (on the laptop, in the AxLeads folder)

```bash
pnpm install        # once
pnpm db:prod node scripts/export-tenant.mjs --tenant <hauspire slug or name> --out hauspire-export.json
```

It prints the production host, then the counts: members, stages, fields, leads (and how many are in
the bin), activities, messages. It runs in one read-only transaction. **The file holds client
personal data** — keep it on the laptop and delete it after step 4.

### 2. Apply the migration to One Interiors

`prisma/migrations/20261021110000_axleads_import` (columns only: `studio_clients.importedFrom`,
`studio_clients.externalId`, `studio_client_events.externalId`, two unique indexes, and the
`IMPORTED` history kind). Deployed with the next release (`prisma migrate deploy`). The import
refuses to run without it.

### 3. Dry run (writes nothing)

In the One Interiors folder:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\with-env.ps1 npx tsx scripts/import-axleads.ts --file ..\path\to\hauspire-export.json --studio hauspire-luxury-design-studio --dry-run
```

(`with-env.ps1` loads `.env.local`; the import itself reads only `DATABASE_URL` from the
environment and prints the host it is about to use.) Read the report:

- **Leads**: new cards, merged into a card (already on the board, or the same number twice in the
  file), already imported, without a phone, phones that were not mobiles.
- **New cards per column / per person / per source.**
- **History lines** by kind, and what was left out (score recalculations; message stubs whose
  messages come over with their text).
- **Stages**: each AxLeads stage → our column. Lines marked `← CHECK` were not a plain name match.
- **People**: `=` matched (by phone, then email), `+ ADD` (added as INVITED, no invite sent),
  `✗ REFUSED` (the number is a customer's, One Interiors', or another studio's), `✗ no phone`,
  `–` left AxLeads.
- Fields to add, source names to add, form answers with no field (kept in the notes), duplicates merged.

If something is wrong, write a roles file (below) and dry-run again.

### 4. Real run

The same command without `--dry-run`, plus `--roles roles.json` if you made one. It prints the
report again, then what it wrote, and leaves one audit row (`studio.import.axleads`). Running it a
second time is safe: everything already imported is skipped; a lead still in the pool is given to
its person if that person has since been matched (e.g. you added their phone in the roles file).

### 5. Check

Open `/studio/clients`: the counts per column, a few leads' timelines (each ends with "Imported from
AxLeads — was in …"), the pool, and the bin (leads that were in the AxLeads bin). Settings → Team
shows the people added as "Invite sent, not signed in yet" — **no invite was actually sent**; use
Resend invite there when you want them to sign in. Settings → Fields shows any fields added.

## The roles file (optional)

```json
{
  "roles": { "OWNER": "OWNER", "AGENT": "SALES" },
  "members": {
    "someone@hauspire.example": { "phone": "+91 98xxx xxxxx", "role": "DESIGNER" },
    "old.account@hauspire.example": { "skip": true }
  },
  "stages": { "Junk": "Junk", "Site visit": "Visit Planned" },
  "binned": "bin",
  "createFields": true
}
```

- `roles` — AxLeads OWNER / AGENT → our role. Default OWNER → Owner, AGENT → Sales.
- `members` — keyed by the AxLeads email (or user id): a phone (AxLeads keeps none on the member;
  the export takes it from the login when it can), a role, or `skip`.
- `stages` — AxLeads stage name → our column name. Wins over everything else.
- `binned` — `bin` (default: into our bin, thirty days from the import) or `skip`.
- `createFields` — add the AxLeads workspace's custom fields as studio fields (default true).

## The rules (src/modules/studio-import-axleads/map.ts)

- **Stages** by name (case and spacing ignored) when the meaning agrees: a lost lead lands only in a
  Lost column, a won one only in a Signed / Finished column. Otherwise by meaning: intake → the
  intake column, won → the first Signed column, lost → the first Lost column; anything else → the
  intake column, with "Stage on AxLeads: …" in its notes. Hauspire's own pipeline is the same list
  (`HAUSPIRE_PIPELINE`), except that **Junk** is a Lost stage in AxLeads and an open column here, so
  junk leads go to **Lost** (reason "Not serious", note "Junk") unless the roles file says
  `"Junk": "Junk"`.
- **Lost reason**: AxLeads' free text is read for one of ours (budget, went elsewhere, no response,
  wrong number, postponed, timeline, not serious, else other) and always kept as the note.
- **Sources**: Meta lead ad → Facebook (Instagram when the lead says so); Google lead form and the
  AxLeads website form → Website; WhatsApp / WhatsApp ad / webhook → Other with the studio source
  name "WhatsApp" / "WhatsApp ads" / "Webhook"; referral → Referral; typed in → Other. The source
  note reads "AxLeads · Meta lead ad · <page or form>".
- **Fields**: BHK → Config, society/building/project → Society, carpet area → Carpet; answers whose
  key is a studio field (or an AxLeads custom field, added) go into the field; everything else —
  score, campaign / ad set / ad / form ids, gclid, UTM, timeline, requirements, a budget range,
  open follow-ups, a phone that is not a mobile — into a "From AxLeads" block in the notes.
- **History**: calls → Contact lines with the outcome, reactions, minutes and note; notes → Notes
  (with their author); stage changes, assignments, lost, bin and restore as themselves; tags →
  Edited; WhatsApp messages, hot alerts, duplicate flags → the new **Imported** kind (not Notes,
  not Contact, so they neither fill the notes panel nor count as calls). Score recalculations are
  left out. The last call sets "last contacted"; an open call-back sets the follow-up.
- **People**: matched to the team by phone, then email. Not on the team → added INVITED under
  Settings → Team's rules; refused numbers are reported and their leads go to the pool. No phone,
  left AxLeads, or skipped → the pool; their names stay on the history lines they wrote.
- **Duplicates**: the same mobile already on the board (not in the bin), or twice in the file, is
  one card: history appended, blanks filled, notes appended, nothing overwritten, and its person
  set only when it had nobody.
- **Idempotent**: each card has `importedFrom = "axleads"` and the AxLeads lead id, each history
  line `externalId = "axleads:<id>"`, unique per studio. Cards are written 200 at a time, each
  batch with its history in one transaction.

## Tests

- `tests/axleads-import-map.test.ts` — the rules, on the fake export
  `tests/fixtures/axleads-export.fake.json` (invented names, +9190000… numbers).
- `tests/axleads-import-db.integration.test.ts` — dry run, real run and a second run against the
  local throwaway database only (skipped unless `AXLEADS_IMPORT_TEST_DB=1`; needs the migration
  applied there):

  ```bash
  AXLEADS_IMPORT_TEST_DB=1 DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&connection_limit=1&pgbouncer=true' \
    npx vitest run tests/axleads-import-db.integration.test.ts
  ```
