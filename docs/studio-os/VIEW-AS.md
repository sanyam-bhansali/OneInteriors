# Developer access: "Open as…" (owner, 22 Oct 2026)

The founder checks bugs by looking at a studio's software **exactly as one of its people sees it**, without signing in as them and without being able to change anything.

- Who: a One Interiors staff login, `User.role` OPS or ADMIN. Never a studio or customer account.
- What: any studio, as any of its members. Their home, their apps, the leads their sales role reaches, the pool, quotations, the projects their fixed role sees, plan gating. Read only.
- How long: two hours. Then the view is ignored and cleared on the next request.
- Audit: every start (`staff.view_as.start`) and every Stop (`staff.view_as.stop`) is an `AuditLog` row with the actor, the member and the studio.

## Using it

1. Ops console → open the studio (`/ops/<slug>`) → **Open as… (developer access)** → pick the person → **Open, read only**.
2. The studio software opens on the studio host as that person. A dark red bar across the top says **Viewing as <name> (<role>, <sales role>) · <studio> · read only · ends <time>**, and a **Stop** pill stays in the bottom-right corner on every page.
3. **Stop** ends the view and goes back to `/ops/<slug>`.

Nothing can be changed while viewing: buttons that save look greyed, and if one is pressed anyway the request is refused (403 from the middleware, or "sign in" / "not allowed" from the server).

## How it works

### State: four columns on `Session`

Migration `20261022120000_staff_view_as` (expand only; `sessions` is already under RLS with everything revoked from anon and authenticated):

| Column | Meaning |
| --- | --- |
| `viewAsMemberId` | The `studio_members` row being viewed. No foreign key: re-checked on every request, and a member that is gone ends the view. |
| `viewAsUntil` | When the view stops being honoured (start + 120 minutes). |
| `viewAsTicketHash` | SHA-256 of the one-time ticket that carries the view from the ops host to the studio host (two minutes, single use, unique). Cleared when redeemed. |
| `viewAsOnly` | The session exists only for the view; Stop revokes it. |

### The round trip

Cookies are host-only (`lib/host.ts`), so the ops session is never sent to `studio.oneinteriors.in`. The view therefore travels by ticket, like a sign-in link:

1. `startViewAs` (`src/modules/studio/view-as.ts`, called by `startViewAsAction` in `src/app/ops/[slug]/actions.ts`): OPS/ADMIN only; checks the member is on that studio (`checkViewTarget`); creates a session row for the admin carrying the view (expires with it) and the ticket hash; writes `staff.view_as.start`; returns `https://<STUDIO_HOST>/api/staff/view-as/enter?ticket=…` (same origin when the hosts are not split). The page goes there with a full load.
2. `GET /api/staff/view-as/enter` → `enterViewAs`: redeems the ticket once (atomic `updateMany` on the hash). If the browser already has a session of the **same** admin there (single origin: local, preview), the view is put on that session and the spare row revoked; a session of anyone else is refused. Otherwise the spare row's token is rotated and set as the studio host's `oi_session` cookie. The session token never appears in a URL. Sets the `oi_viewas` hint cookie and redirects to `/studio`.
3. `POST /api/staff/view-as/stop` → `stopViewAs`: clears the view (revokes a view-only session and drops its cookie), writes `staff.view_as.stop`, drops the hint, returns to `/ops/<slug>` (on the ops host by a one-line page, because the CSP's `form-action 'self'` also covers a form's cross-origin redirect).

### Resolution

`liveView()` (React `cache`, once per request) reads the session cookie only (the phone app's bearer token never views as anyone), checks the session, and applies `viewStateOf` (`src/modules/studio/view-as-rules.ts`): staff only, member set, end in the future and no further away than one view. An expired view is cleared lazily.

- `access.ts currentMember()` → `viewAsFor(user)`: for staff with a live view, the viewed member (`memberById`, the same `MEMBER_SELECT`: sales role, subtree, plan flags) marked `viewOnly: true`. Everything that starts from `currentMember` (lead scope, quotations, projects, site, design, crews, Today, My work) therefore behaves as that member.
- `tenancy.ts myStudioId()`: for staff with a live view, the viewed member's studio by the same `OFFICE_MEMBER` rule.
- `app/studio/layout.tsx`: the viewed member decides the door, the frame, the apps and the rail; the banner wraps every frame.
- Not viewing: all of the above is exactly as before (an ops account looking in still has no membership and sees every app with no studio's data).

## Read-only enforcement (each layer holds on its own)

| Layer | Where | What it refuses |
| --- | --- | --- |
| 1. Middleware | `src/middleware.ts` `viewAsRefusal` → `viewAsGate` (pure) | Any write (a `Next-Action` server action, or a method other than GET/HEAD/OPTIONS) to the studio app — the whole studio host when split; `/studio`, `/api/studio`, `/api/staff` on one origin — while the hint is live. 403. Only `POST /api/staff/view-as/stop` passes. The hint is `oi_viewas`, httpOnly, an HMAC over the session cookie's hash and the end time, keyed with an existing server secret (`SUPABASE_SECRET_KEY`, else `CRON_SECRET`; plain SHA-256 on a laptop with neither). It is only a hint: forged or stale it refuses only its sender's writes; missing, it widens nothing. |
| 2. Resolution | `access.ts viewAsFor` (used by `currentMember`), `tenancy.ts myStudioId` | On a write request (`requestIsWrite`: `Next-Action` present, method not GET/HEAD, or no method header at all) a viewing session is **no member and no studio**, so every write helper finds nobody to write as. The method comes from `x-oi-method`, which the middleware always overwrites. |
| 3. Permissions | `roles.ts can()` (root check), `access.ts assertCan` | A `viewOnly` member may take only `READ_ACTIONS`: `project.read`, `payment.read`, `lead.read`, `lead.pool`, `lead.analytics`, `design.workload`, `crew.list`, `workorder.read`, `workorder.money`, `vendor.rates`. Every other action is refused for every role, on any request (GET included). `lead.export` is deliberately not a read here: the whole lead list does not leave the building on a developer view. |
| 4. UI | `app/studio/ViewAsBanner.tsx` | The banner and Stop; buttons in posting forms dimmed. Most write buttons are hidden anyway because the screens ask `can()`. Never relied on. |

Screens are drawn as the member sees them: `surfaces.ts mayOpen`, `apps.ts appsFor`, the rail and the visibility `where`s (`poolVisibleTo`, `quotesVisibleTo`) evaluate the member without the flag (`roles.ts asSeenBy`). Writes never use `asSeenBy`.

`vendor.rates` and `workorder.money` are reads that also gate some writes (labour rates; crew bills and balances). They are reads so the view shows that member's money; their writes are refused by layers 1 and 2.

## What is allowed while viewing

- Every GET: pages, navigation, filters, search via GET forms, files and downloads behind a read right.
- Stop.

## What is not

- Every server action, every non-GET API call to the studio app, `lead.export`.
- Signing out from the studio frame (it is a server action); use Stop.
- Anything outside that studio: the view resolves to one member of one studio, and the studio modules scope by that member's studio as they always do. Ops data is not reachable from the studio app, and customer data only as far as that member's own screens show it.

## Known limits

- **Render-time writes.** A few studio screens write while rendering (for example creating a studio's default pipeline columns on first open). Those run on GET, so a view can trigger them, as the member opening the page would. They are idempotent set-up writes; nothing a person does is recorded. A database-level read-only guard was not added (it would sit on every query of every request).
- **Screens keyed on the signed-in user's own id** (inbox, notifications, the guide, introductions, onboarding, studio team self-lookups) look up the admin, not the member, so they show empty rather than the member's items.
- **A screen gated on a write right** (for example a page that opens only with `team.manage`, rather than through `mayOpen`) shows its "not allowed" state while viewing.
- Not verified end to end against a database or across the split hosts yet; the rules and the wiring are covered by `tests/view-as.test.ts`.
