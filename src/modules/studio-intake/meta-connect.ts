/**
 * "Connect Facebook" for Meta lead ads (owner, 12 Nov 2026;
 * docs/studio-os/LEAD-INTAKE.md): the pure halves, tested without a network
 * (tests/studio-meta-connect.test.ts).
 *
 * ## The owner logs in, not One Interiors
 *
 * The studio owner presses Connect Facebook, logs in to Facebook and allows
 * our Meta app to read their Pages' leads. We keep a long-lived user token
 * (about 60 days) to list their Pages and ad accounts, and for each Page they
 * pick, that Page's own token (which does not expire while the login that
 * made it stands). Both are sealed (AES-256-GCM) before they touch the
 * database, never logged and never sent to a browser.
 *
 * ## Which campaigns (owner, 12 Nov 2026)
 *
 * A connected Page takes every campaign's leads, or only the campaigns the
 * owner picked. A lead from any other campaign is recorded as SKIPPED (with
 * its campaign, so the picker can offer it) and not put on the board;
 * picking that campaign later brings its skipped leads in. A lead from a form
 * opened on the Page itself, not from an ad, has no campaign: it counts as
 * the campaign `NO_CAMPAIGN`, which can be picked like any other.
 *
 * ## Past leads
 *
 * Meta keeps a form's leads for 90 days. "Bring in past leads" reads each of
 * the Page's forms back that far and lands each lead the way the webhook
 * would, once (the same claim on the leadgen id), quietly: nobody is
 * notified for hundreds of old leads, and a person already on the board is
 * left as they are.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { isMetaId } from './payloads';

export const GRAPH = 'https://graph.facebook.com/v23.0';
export const DIALOG = 'https://www.facebook.com/v23.0/dialog/oauth';

/**
 * What the owner is asked to allow. Lead ads retrieval needs a Page token
 * from someone who can advertise on the Page with leads_retrieval,
 * pages_manage_ads, pages_read_engagement and pages_show_list;
 * pages_manage_metadata subscribes the Page to the webhook; ads_read lists
 * the ad account's campaigns; business_management shows Pages a Business
 * Manager owns.
 */
export const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_manage_ads',
  'leads_retrieval',
  'ads_read',
  'business_management',
] as const;

/** A lead that came from no ad (a form opened on the Page). */
export const NO_CAMPAIGN = 'none';
export const NO_CAMPAIGN_NAME = 'Not from an ad (form on the Page)';

/** How far back Meta keeps leads. */
export const BACKFILL_DAYS = 90;

// ── Sealing tokens ─────────────────────────────────────────────

/**
 * The sealing key: env `STUDIO_TOKEN_KEY` if set, else `SESSION_SECRET`,
 * hashed with a label so it is never the session key itself. Null when
 * neither is set (nothing is connected then; the screen says why). Changing
 * it means connecting Facebook again.
 */
export function sealingKey(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): Buffer | null {
  const raw = env.STUDIO_TOKEN_KEY?.trim() || env.SESSION_SECRET?.trim();
  if (!raw || raw.length < 16) return null;
  return createHash('sha256').update(`oi-studio-token|${raw}`, 'utf8').digest();
}

/** `v1.<iv>.<tag>.<ciphertext>`, base64url. */
export function seal(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

/** The token, or null when it was sealed with another key or tampered with. Never throws. */
export function unseal(sealed: string | null | undefined, key: Buffer | null): string | null {
  if (!sealed || !key) return null;
  const [v, iv, tag, body] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !body) return null;
  try {
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ── The login ──────────────────────────────────────────────────

/** Meta's app, or null when One Interiors has not set it up. */
export function metaApp(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): { appId: string; appSecret: string } | null {
  const appId = env.META_APP_ID?.trim();
  const appSecret = env.META_APP_SECRET?.trim();
  return appId && /^\d{5,32}$/.test(appId) && appSecret ? { appId, appSecret } : null;
}

export function loginUrl({ appId, redirectUri, state }: { appId: string; redirectUri: string; state: string }): string {
  const u = new URL(DIALOG);
  u.searchParams.set('client_id', appId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', META_SCOPES.join(','));
  /* Asked again on a reconnect, so a permission refused last time can be given. */
  u.searchParams.set('auth_type', 'rerequest');
  return u.toString();
}

/** `{ access_token, expires_in }` from Graph's token endpoint, or null. */
export function readToken(body: unknown): { token: string; expiresIn: number | null } | null {
  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (typeof o.access_token !== 'string' || o.access_token.length < 20) return null;
  const exp = typeof o.expires_in === 'number' && o.expires_in > 0 ? o.expires_in : null;
  return { token: o.access_token, expiresIn: exp };
}

// ── Graph lists ────────────────────────────────────────────────

export interface MetaPage {
  id: string;
  name: string;
  /** Only on the server, only between Graph and `seal`. */
  token: string | null;
  /** Whether this person may advertise on it (needed to read its leads). */
  canAdvertise: boolean;
}

/** `GET /me/accounts?fields=id,name,access_token,tasks`. */
export function readPages(body: unknown): MetaPage[] {
  const data = listOf(body);
  const out: MetaPage[] = [];
  for (const p of data) {
    if (!isMetaId(p.id)) continue;
    const tasks = Array.isArray(p.tasks) ? p.tasks.filter((t): t is string => typeof t === 'string') : [];
    out.push({
      id: p.id,
      name: str(p.name, 120) ?? `Page ${p.id}`,
      token: typeof p.access_token === 'string' && p.access_token.length >= 20 ? p.access_token : null,
      /* No tasks listed (older Pages): let Graph be the judge later. */
      canAdvertise: tasks.length === 0 || tasks.includes('ADVERTISE') || tasks.includes('MANAGE'),
    });
  }
  return out;
}

export interface MetaCampaign {
  id: string;
  name: string;
  /** ACTIVE, PAUSED, ARCHIVED… as Meta says; null when only seen on a lead. */
  status: string | null;
}

/** `GET /act_X/campaigns?fields=id,name,effective_status,objective`: the lead-gathering ones. */
export function readCampaigns(body: unknown): MetaCampaign[] {
  const out: MetaCampaign[] = [];
  for (const c of listOf(body)) {
    if (!isMetaId(c.id)) continue;
    const objective = typeof c.objective === 'string' ? c.objective : '';
    /* Instant forms run under the leads objective (old name LEAD_GENERATION). */
    if (objective && objective !== 'OUTCOME_LEADS' && objective !== 'LEAD_GENERATION') continue;
    out.push({ id: c.id, name: str(c.name, 160) ?? `Campaign ${c.id}`, status: str(c.effective_status, 30) });
  }
  return out;
}

/** `GET /me/adaccounts?fields=id,name,account_status`: ids are `act_<digits>`. */
export function readAdAccounts(body: unknown): { id: string; name: string }[] {
  return listOf(body)
    .filter((a): a is Record<string, unknown> & { id: string } => typeof a.id === 'string' && /^act_\d{1,32}$/.test(a.id))
    .map((a) => ({ id: a.id, name: str(a.name, 120) ?? a.id }));
}

/** `GET /{page}/leadgen_forms?fields=id,name,status`. */
export function readForms(body: unknown): { id: string; name: string }[] {
  return listOf(body)
    .filter((f): f is Record<string, unknown> & { id: string } => isMetaId(f.id))
    .map((f) => ({ id: f.id, name: str(f.name, 120) ?? `Form ${f.id}` }));
}

/** The next page's cursor, never Graph's `paging.next` URL (it carries the token). */
export function afterCursor(body: unknown): string | null {
  const o = body && typeof body === 'object' ? (body as { paging?: { cursors?: { after?: unknown }; next?: unknown } }) : {};
  const after = o.paging?.cursors?.after;
  return typeof o.paging?.next === 'string' && typeof after === 'string' && after.length > 0 && after.length < 500 ? after : null;
}

/** The fields a lead is read with, on the webhook and in past leads alike. */
export const LEAD_FIELDS = 'id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform';

/** A form's leads since `sinceUnix`, a page at a time. */
export function formLeadsUrl(formId: string, sinceUnix: number, after: string | null): string {
  const u = new URL(`${GRAPH}/${formId}/leads`);
  u.searchParams.set('fields', LEAD_FIELDS);
  u.searchParams.set('limit', '100');
  u.searchParams.set('filtering', JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: sinceUnix }]));
  if (after) u.searchParams.set('after', after);
  return u.toString();
}

/** The leads in one page of `formLeadsUrl`, as raw Graph objects for `parseMetaLead`. */
export function readLeadPage(body: unknown): Record<string, unknown>[] {
  return listOf(body).filter((l) => isMetaId(l.id));
}

// ── Which campaigns ────────────────────────────────────────────

export interface CampaignRule {
  only: boolean;
  ids: readonly string[];
}

/** The campaign a lead counts under: its id, or `NO_CAMPAIGN`. */
export function campaignKey(campaignId: string | null | undefined): string {
  return campaignId && isMetaId(campaignId) ? campaignId : NO_CAMPAIGN;
}

/** Whether this lead's campaign is one the studio takes. */
export function campaignAllowed(rule: CampaignRule, campaignId: string | null | undefined): boolean {
  return !rule.only || rule.ids.includes(campaignKey(campaignId));
}

/** What the owner sent from the picker, cleaned: Meta ids or `NO_CAMPAIGN`, at most 200. */
export function cleanCampaignPick(raw: unknown): { id: string; name: string }[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: { id: string; name: string }[] = [];
  for (const r of raw.slice(0, 200)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as { id?: unknown; name?: unknown };
    const id = o.id === NO_CAMPAIGN ? NO_CAMPAIGN : isMetaId(o.id) ? o.id : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: str(o.name, 160) ?? (id === NO_CAMPAIGN ? NO_CAMPAIGN_NAME : `Campaign ${id}`) });
  }
  return out;
}

/**
 * One list for the picker: the ad accounts' lead campaigns first (live, with
 * their status), then campaigns only seen on leads, then picked ones Meta no
 * longer lists. Each id once; the first name seen wins.
 */
export function mergeCampaigns(...lists: readonly (readonly MetaCampaign[])[]): MetaCampaign[] {
  const out = new Map<string, MetaCampaign>();
  for (const list of lists) for (const c of list) if (!out.has(c.id)) out.set(c.id, c);
  return [...out.values()];
}

/** The picked list saved on the connection, read back. Never throws. */
export function readSavedCampaigns(raw: unknown): MetaCampaign[] {
  return cleanCampaignPick(raw).map((c) => ({ ...c, status: null }));
}

// ── Small readers ──────────────────────────────────────────────

function listOf(body: unknown): Record<string, unknown>[] {
  const d = body && typeof body === 'object' ? (body as { data?: unknown }).data : undefined;
  return Array.isArray(d) ? d.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object').slice(0, 500) : [];
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}
