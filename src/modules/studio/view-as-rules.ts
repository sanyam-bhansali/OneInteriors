/**
 * Developer access, "Open as…" (owner, 22 Oct 2026; docs/studio-os/VIEW-AS.md):
 * the founder's One Interiors staff login (OPS or ADMIN) opens any studio's
 * software as any of its members, read only, to check a bug exactly as that
 * person sees it. A banner says so on every page; a view lasts two hours;
 * every start and stop is in the audit log.
 *
 * Pure (CONTRIBUTING §9.5): no Prisma, no `server-only`, no Node imports, so
 * the edge middleware imports it as well as the server, and
 * tests/view-as.test.ts asserts every rule here directly.
 *
 * ## Where the truth lives
 *
 * The view is a row, not a claim: four columns on the admin's own `Session`
 * (schema.prisma), read fresh on every request by studio/view-as.ts. The
 * middleware cannot read Postgres, so it gets a companion cookie
 * (`oi_viewas`) that is only ever a HINT used to refuse writes early. A
 * forged, stale or missing hint can never widen anything: without the row
 * there is no view, and with the row the server refuses writes whatever the
 * cookie says.
 *
 * ## The layers that keep it read only (each one alone would hold)
 *
 *  1. middleware.ts: a live hint and a non-GET request to the studio app → 403
 *     (`viewAsGate`), except the one Stop route.
 *  2. access.ts `currentMember` / tenancy.ts `myStudioId`: on a write request
 *     (a server action, or any method but GET/HEAD) a viewing session resolves
 *     to NO member and NO studio (`requestIsWrite`), so every write helper
 *     finds nobody to write as.
 *  3. roles.ts `can()`: a `viewOnly` member may take only the read actions
 *     (`READ_ACTIONS` there), on any request, GET included.
 *  4. The UI: the banner, and write buttons dimmed (studio-extra.css). Never
 *     relied on.
 */

/** How long a view lasts (owner, 22 Oct 2026). */
export const VIEW_AS_MINUTES = 120;
/** How long the ops-to-studio ticket may wait to be redeemed. */
export const VIEW_AS_TICKET_SECONDS = 120;

/** The companion cookie the middleware reads (a hint, never authority). */
export const VIEW_AS_HINT_COOKIE = 'oi_viewas';
/** The one write a viewing session may make: stopping. Its own route, so the middleware can allow it by path. */
export const VIEW_AS_STOP_PATH = '/api/staff/view-as/stop';
/** Where the ticket is redeemed on the studio host. GET, so the middleware never blocks it. */
export const VIEW_AS_ENTER_PATH = '/api/staff/view-as/enter';
/** The request method, set by the middleware on every request it passes on (always overwritten, so a client cannot supply its own). */
export const METHOD_HEADER = 'x-oi-method';
/** Next.js marks every server action call with this header. */
export const NEXT_ACTION_HEADER = 'next-action';

export type StaffRoleName = 'CUSTOMER' | 'STUDIO' | 'OPS' | 'ADMIN';

/** Only One Interiors staff may view as anyone. Never a studio or a customer account. */
export const isStaff = (role: StaffRoleName | string | null | undefined): boolean => role === 'OPS' || role === 'ADMIN';

/** When a view started now ends. */
export const viewUntil = (now: Date): Date => new Date(now.getTime() + VIEW_AS_MINUTES * 60_000);

export type ViewState =
  | { kind: 'none' }
  /** The columns are set but no longer honoured: clear them (lazily). */
  | { kind: 'expired' }
  | { kind: 'live'; memberId: string; until: Date };

/**
 * Whether a session's view is live.
 *
 * Staff only: a STUDIO or CUSTOMER session with the columns set (it cannot
 * get there, but if it did) is "none", never a view. An `until` further away
 * than one full view is not honoured either — nothing writes one, so it can
 * only be a mistake, and a mistake must not mean "forever".
 */
export function viewStateOf(row: { role: StaffRoleName | string; memberId: string | null; until: Date | null }, now: Date): ViewState {
  if (!row.memberId && !row.until) return { kind: 'none' };
  if (!isStaff(row.role)) return { kind: 'expired' };
  if (!row.memberId || !row.until) return { kind: 'expired' };
  const left = row.until.getTime() - now.getTime();
  if (left <= 0) return { kind: 'expired' };
  if (left > VIEW_AS_MINUTES * 60_000 + 60_000) return { kind: 'expired' };
  return { kind: 'live', memberId: row.memberId, until: row.until };
}

export type ViewTargetCheck = { ok: true } | { ok: false; error: string };

/**
 * May this actor start viewing this member of this studio? Staff only, and the
 * member must belong to the studio the ops page is about — the member id comes
 * off a form, so it is checked against the studio, never trusted.
 */
export function checkViewTarget(actorRole: StaffRoleName | string | null | undefined, member: { studioId: string } | null, studioId: string): ViewTargetCheck {
  if (!isStaff(actorRole)) return { ok: false, error: 'Only One Interiors staff can open a studio as one of its people.' };
  if (!member || !studioId || member.studioId !== studioId) return { ok: false, error: 'That person is not on this studio’s team.' };
  return { ok: true };
}

/** A ticket is redeemable for two minutes after it was made, once. */
export function ticketUsable(createdAt: Date, now: Date): boolean {
  const age = now.getTime() - createdAt.getTime();
  return age >= 0 && age <= VIEW_AS_TICKET_SECONDS * 1000;
}

/**
 * Is this request a write, for a viewing session? A server action is, whatever
 * its method; so is anything but GET or HEAD. No method header at all means
 * the middleware did not run, and the answer is the safe one: a write.
 */
export function requestIsWrite(h: { method: string | null | undefined; nextAction: string | null | undefined }): boolean {
  if (h.nextAction) return true;
  if (!h.method) return true;
  const m = h.method.toUpperCase();
  return m !== 'GET' && m !== 'HEAD';
}

function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * The middleware's decision for a request from a session whose hint is live
 * (`viewing`). Blocks every write to the studio app — its pages' server
 * actions and its API — and allows only the Stop route. Reads always pass.
 *
 * "The studio app" is the whole studio host when the hosts are split, and
 * `/studio`, `/api/studio` and `/api/staff` on a single origin (local, preview)
 * — where the same browser may be using /ops in another tab, which this
 * leaves alone.
 */
export function viewAsGate(input: { method: string; path: string; audience: 'studio' | 'ops' | 'public' | 'all'; nextAction: boolean; viewing: boolean }): 'allow' | 'block' {
  if (!input.viewing) return 'allow';
  if (input.path === VIEW_AS_STOP_PATH) return 'allow';
  const m = input.method.toUpperCase();
  const write = input.nextAction || (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS');
  if (!write) return 'allow';
  const studioApp =
    input.audience === 'studio' || under(input.path, '/studio') || under(input.path, '/studio-sign-in') || under(input.path, '/api/studio') || under(input.path, '/api/staff');
  return studioApp ? 'block' : 'allow';
}

// ── The companion cookie ─────────────────────────────────────────

/**
 * The server secret the hint is signed with. An existing one, never a new
 * value: SUPABASE_SECRET_KEY (server only, on every deployment), else
 * CRON_SECRET. Domain-separated by a prefix in `hintSignature`, so the raw
 * secret never signs anything else's bytes. With neither (a laptop), the hint
 * is a plain SHA-256 bound to the session — still useless without the
 * session cookie, and still only ever a hint.
 */
export function hintSecret(env: Record<string, string | undefined>): string | null {
  return env.SUPABASE_SECRET_KEY?.trim() || env.CRON_SECRET?.trim() || null;
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(text: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

/** The signature over (the session cookie's hash, the view's end). Web Crypto, so the edge runtime can check it. */
async function hintSignature(secret: string | null, sessionToken: string, untilMs: number): Promise<string> {
  const payload = `oi-view-as-hint-v1|${await sha256(sessionToken)}|${untilMs}`;
  if (!secret) return sha256(payload);
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

/** The hint cookie's value for this session and view. */
export async function signHint(secret: string | null, sessionToken: string, until: Date): Promise<string> {
  const ms = until.getTime();
  return `${ms}.${await hintSignature(secret, sessionToken, ms)}`;
}

/** Whether the hint is this session's and still in date. Constant work whatever the input. */
export async function hintIsLive(secret: string | null, sessionToken: string | null | undefined, hint: string | null | undefined, now: Date): Promise<boolean> {
  if (!sessionToken || !hint) return false;
  const dot = hint.indexOf('.');
  if (dot <= 0) return false;
  const ms = Number(hint.slice(0, dot));
  if (!Number.isFinite(ms) || ms <= now.getTime()) return false;
  const expected = await hintSignature(secret, sessionToken, ms);
  const given = hint.slice(dot + 1);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
