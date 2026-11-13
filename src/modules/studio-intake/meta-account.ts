import 'server-only';

/**
 * "Connect Facebook" for a studio's Meta lead ads (owner, 12 Nov 2026;
 * docs/studio-os/LEAD-INTAKE.md). The pure rules are in `meta-connect.ts`.
 *
 * Who: the members who keep the studio's lead settings (`lead.settings`),
 * never a developer viewing as them. Every read and write is scoped by the
 * member's own studio. Tokens are sealed before they are stored and never
 * leave the server: the screens get Page names and ids, nothing else.
 */

import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { siteUrlFor } from '@/lib/site';
import { currentMember } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { hashSecret, newSecret } from './secrets';
import { graphError, isMetaId } from './payloads';
import {
  GRAPH,
  NO_CAMPAIGN,
  NO_CAMPAIGN_NAME,
  cleanCampaignPick,
  loginUrl,
  mergeCampaigns,
  metaApp,
  readAdAccounts,
  readCampaigns,
  readPages,
  readSavedCampaigns,
  readToken,
  seal,
  sealingKey,
  unseal,
  type MetaCampaign,
} from './meta-connect';

export const STATE_COOKIE = 'oi_meta_state';

export function callbackUrl(): string {
  return `${siteUrlFor('studio').replace(/\/+$/, '')}/api/studio/meta/callback`;
}

async function manager() {
  const member = await currentMember();
  if (!member || member.viewOnly === true || !can(member, 'lead.settings')) return null;
  return member;
}

type Fail = { ok: false; error: string };
const REFUSED: Fail = { ok: false, error: 'Your role does not include connecting where leads come in from. Ask your studio owner.' };

/** What stops Connect Facebook from working at all, in words for the owner; null when nothing does. */
export function connectBlocker(): string | null {
  if (!metaApp()) return 'One Interiors has not finished setting up its Meta app yet (META_APP_ID and META_APP_SECRET).';
  if (!sealingKey()) return 'One Interiors has not set the key that locks Facebook tokens (STUDIO_TOKEN_KEY).';
  return null;
}

// ── The login ──────────────────────────────────────────────────

/** Where to send the owner to log in, and the state to keep in a cookie. */
export async function startLogin(): Promise<{ ok: true; url: string; state: string } | Fail> {
  if (!(await manager())) return REFUSED;
  const blocked = connectBlocker();
  const app = metaApp();
  if (blocked || !app) return { ok: false, error: blocked ?? 'Not set up.' };
  const state = randomBytes(24).toString('base64url');
  return { ok: true, url: loginUrl({ appId: app.appId, redirectUri: callbackUrl(), state }), state };
}

async function graphJson(url: string, init?: RequestInit): Promise<{ ok: true; body: unknown } | Fail> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    const body = await res.json().catch(() => null);
    return res.ok ? { ok: true, body } : { ok: false, error: graphError(body, res.status).replace('Meta did not give the lead', 'Facebook said') };
  } catch {
    return { ok: false, error: 'Facebook could not be reached. Try again.' };
  }
}

const bearer = (token: string): RequestInit => ({ headers: { authorization: `Bearer ${token}` } });

/**
 * Facebook sent the owner back with a code: swap it for a long-lived user
 * token, seal it and keep it for the studio. The code and the app secret go
 * server to server only.
 */
export async function finishLogin(code: string): Promise<{ ok: true } | Fail> {
  const member = await manager();
  if (!member) return REFUSED;
  const app = metaApp();
  const key = sealingKey();
  if (!app || !key) return { ok: false, error: connectBlocker() ?? 'Not set up.' };
  if (!/^[\w.-]{10,1000}$/.test(code)) return { ok: false, error: 'Facebook sent back something we could not read. Try again.' };

  const short = new URL(`${GRAPH}/oauth/access_token`);
  short.searchParams.set('client_id', app.appId);
  short.searchParams.set('client_secret', app.appSecret);
  short.searchParams.set('redirect_uri', callbackUrl());
  short.searchParams.set('code', code);
  const first = await graphJson(short.toString());
  if (!first.ok) return first;
  const shortToken = readToken(first.body);
  if (!shortToken) return { ok: false, error: 'Facebook did not give us access. Try again.' };

  const long = new URL(`${GRAPH}/oauth/access_token`);
  long.searchParams.set('grant_type', 'fb_exchange_token');
  long.searchParams.set('client_id', app.appId);
  long.searchParams.set('client_secret', app.appSecret);
  long.searchParams.set('fb_exchange_token', shortToken.token);
  const second = await graphJson(long.toString());
  const longToken = second.ok ? readToken(second.body) : null;
  const token = longToken ?? shortToken;

  const me = await graphJson(`${GRAPH}/me?fields=name`, bearer(token.token));
  const name = me.ok && me.body && typeof (me.body as { name?: unknown }).name === 'string' ? String((me.body as { name: string }).name).slice(0, 80) : null;
  const expiresAt = token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000) : null;
  const data = { tokenSealed: seal(token.token, key), fbUserName: name, expiresAt, createdById: member.id };
  await prisma.studioMetaLogin.upsert({ where: { studioId: member.studioId }, create: { studioId: member.studioId, ...data }, update: data });
  await prisma.auditLog.create({ data: { actorId: member.userId, action: 'studio.meta.login', entityType: 'Studio', entityId: member.studioId, after: { fbUserName: name } } });
  return { ok: true };
}

/** The studio's login token, if there is one and it has not run out. */
async function loginToken(studioId: string): Promise<{ token: string; name: string | null } | null> {
  const row = await prisma.studioMetaLogin.findUnique({ where: { studioId }, select: { tokenSealed: true, fbUserName: true, expiresAt: true } });
  if (!row || (row.expiresAt && row.expiresAt.getTime() < Date.now())) return null;
  const token = unseal(row.tokenSealed, sealingKey());
  return token ? { token, name: row.fbUserName } : null;
}

// ── Pages ──────────────────────────────────────────────────────

export interface PagesScreen {
  canManage: boolean;
  blocker: string | null;
  /** Who logged in to Facebook, and until when; null when nobody has or it ran out. */
  login: { name: string | null; untilLabel: string | null } | null;
  pages: { id: string; name: string; canAdvertise: boolean; connectedHere: boolean }[];
  error: string | null;
}

/** The Page picker after a Facebook login. */
export async function myPagesScreen(): Promise<PagesScreen | null> {
  const member = await currentMember();
  if (!member) return null;
  const empty: PagesScreen = { canManage: false, blocker: connectBlocker(), login: null, pages: [], error: null };
  if (member.viewOnly === true || !can(member, 'lead.settings')) return empty;
  const screen: PagesScreen = { ...empty, canManage: true };
  const row = await prisma.studioMetaLogin.findUnique({ where: { studioId: member.studioId }, select: { expiresAt: true } });
  const login = await loginToken(member.studioId);
  if (!login) return screen;
  screen.login = {
    name: login.name,
    untilLabel: row?.expiresAt ? row.expiresAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }) : null,
  };
  const got = await graphJson(`${GRAPH}/me/accounts?fields=id,name,tasks&limit=100`, bearer(login.token));
  if (!got.ok) return { ...screen, error: got.error };
  const mine = await prisma.studioLeadConnection.findMany({ where: { studioId: member.studioId, kind: 'META_PAGE' }, select: { metaPageId: true } });
  const here = new Set(mine.map((m) => m.metaPageId));
  screen.pages = readPages(got.body).map((p) => ({ id: p.id, name: p.name, canAdvertise: p.canAdvertise, connectedHere: here.has(p.id) }));
  return screen;
}

export type ConnectResult = { ok: true; message: string; connectionId: string } | Fail;

/**
 * Connect one Page: take its token from the login, seal it, subscribe the
 * Page to our webhook's `leadgen` field, and make (or renew) its connection.
 * A new connection takes no campaign until the owner picks (owner, 12 Nov
 * 2026): leads that arrive before are kept as skipped and come in when their
 * campaign is picked.
 */
export async function connectPage(pageId: unknown): Promise<ConnectResult> {
  const member = await manager();
  if (!member) return REFUSED;
  const key = sealingKey();
  if (!key || !metaApp()) return { ok: false, error: connectBlocker() ?? 'Not set up.' };
  if (!isMetaId(pageId)) return { ok: false, error: 'Pick a Page.' };
  const login = await loginToken(member.studioId);
  if (!login) return { ok: false, error: 'Your Facebook login has run out. Press Connect Facebook again.' };

  const got = await graphJson(`${GRAPH}/me/accounts?fields=id,name,access_token,tasks&limit=100`, bearer(login.token));
  if (!got.ok) return got;
  const page = readPages(got.body).find((p) => p.id === pageId);
  if (!page || !page.token) return { ok: false, error: 'That Page is not one your Facebook login can manage.' };

  const sub = await graphJson(`${GRAPH}/${page.id}/subscribed_apps`, {
    method: 'POST',
    headers: { authorization: `Bearer ${page.token}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ subscribed_fields: 'leadgen' }).toString(),
  });
  if (!sub.ok) return { ok: false, error: `${sub.error}. Check you are an admin of the Page and allowed every permission.` };

  const existing = await prisma.studioLeadConnection.findUnique({ where: { metaPageId: page.id }, select: { id: true, studioId: true } });
  if (existing && existing.studioId !== member.studioId) return { ok: false, error: 'That Facebook Page is connected to another studio. Ask One Interiors if it should be yours.' };
  const sealed = seal(page.token, key);
  const label = page.name.slice(0, 40);
  let id: string;
  if (existing) {
    await prisma.studioLeadConnection.update({ where: { id: existing.id }, data: { metaTokenSealed: sealed, metaPageName: page.name, metaConnectedAt: new Date(), enabled: true } });
    id = existing.id;
  } else {
    const count = await prisma.studioLeadConnection.count({ where: { studioId: member.studioId } });
    if (count >= 20) return { ok: false, error: 'Twenty connections is the most. Remove one you no longer use.' };
    try {
      const made = await prisma.studioLeadConnection.create({
        data: {
          studioId: member.studioId,
          kind: 'META_PAGE',
          label: label.length >= 2 ? label : 'Facebook Page',
          metaPageId: page.id,
          metaPageName: page.name,
          metaTokenSealed: sealed,
          metaConnectedAt: new Date(),
          metaOnlyCampaigns: true,
          metaCampaignIds: [],
          secretHash: hashSecret(newSecret()),
          createdById: member.id,
        },
        select: { id: true },
      });
      id = made.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { ok: false, error: 'That Facebook Page was just connected. Reload.' };
      throw error;
    }
  }
  await prisma.auditLog.create({ data: { actorId: member.userId, action: 'studio.meta.page_connected', entityType: 'StudioLeadConnection', entityId: id, after: { pageId: page.id, pageName: page.name } } });
  return { ok: true, message: existing ? `${page.name} is connected again.` : `${page.name} is connected. Now pick which campaigns' leads come in.`, connectionId: id };
}

/** Best effort when a Page is removed: stop Meta sending its leads. */
export async function unsubscribePage(pageId: string, sealed: string | null): Promise<void> {
  const token = unseal(sealed, sealingKey());
  if (!token || !isMetaId(pageId)) return;
  await graphJson(`${GRAPH}/${pageId}/subscribed_apps`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
}

// ── Campaigns ──────────────────────────────────────────────────

export interface CampaignChoice extends MetaCampaign {
  /** Leads from it kept as skipped, waiting for it to be picked. */
  waiting: number;
  /** Leads from it already on the board through this Page. */
  landed: number;
}

export type CampaignScreen =
  | { ok: true; only: boolean; picked: string[]; campaigns: CampaignChoice[]; note: string | null }
  | Fail;

/**
 * The picker for one Page: the lead campaigns of every ad account the
 * Facebook login can see (while it lasts), every campaign leads have come
 * from, and whatever was picked before.
 */
export async function campaignScreen(connectionId: unknown): Promise<CampaignScreen> {
  const member = await manager();
  if (!member) return REFUSED;
  if (typeof connectionId !== 'string') return { ok: false, error: 'That connection is not yours.' };
  const conn = await prisma.studioLeadConnection.findFirst({
    where: { id: connectionId, studioId: member.studioId, kind: 'META_PAGE' },
    select: { id: true, metaOnlyCampaigns: true, metaCampaignIds: true, metaCampaigns: true },
  });
  if (!conn) return { ok: false, error: 'That connection is not yours.' };

  let note: string | null = null;
  const live: MetaCampaign[] = [];
  const login = await loginToken(member.studioId);
  if (!login) note = 'Log in with Facebook again (Connect Facebook) to see campaigns that have no leads yet.';
  else {
    const accounts = await graphJson(`${GRAPH}/me/adaccounts?fields=id,name&limit=25`, bearer(login.token));
    if (!accounts.ok) note = `Your ad accounts could not be read: ${accounts.error}`;
    else {
      for (const acct of readAdAccounts(accounts.body).slice(0, 8)) {
        const camps = await graphJson(`${GRAPH}/${acct.id}/campaigns?fields=id,name,effective_status,objective&limit=200`, bearer(login.token));
        if (camps.ok) live.push(...readCampaigns(camps.body));
      }
    }
  }

  const seen = await prisma.studioLeadIntakeEvent.groupBy({
    by: ['campaignId', 'campaignName', 'status'],
    where: { connectionId: conn.id, campaignId: { not: null } },
    _count: { _all: true },
  });
  const fromLeads: MetaCampaign[] = [];
  const waiting = new Map<string, number>();
  const landed = new Map<string, number>();
  for (const g of seen) {
    const id = g.campaignId!;
    fromLeads.push({ id, name: g.campaignName ?? (id === NO_CAMPAIGN ? NO_CAMPAIGN_NAME : `Campaign ${id}`), status: null });
    if (g.status === 'SKIPPED') waiting.set(id, (waiting.get(id) ?? 0) + g._count._all);
    if (g.status === 'LANDED' || g.status === 'DUPLICATE') landed.set(id, (landed.get(id) ?? 0) + g._count._all);
  }
  const all = mergeCampaigns(live, fromLeads, readSavedCampaigns(conn.metaCampaigns));
  if (!all.some((c) => c.id === NO_CAMPAIGN)) all.push({ id: NO_CAMPAIGN, name: NO_CAMPAIGN_NAME, status: null });
  const order = (c: MetaCampaign) => (c.status === 'ACTIVE' ? 0 : c.status === null ? 1 : 2);
  const campaigns = all
    .map((c) => ({ ...c, waiting: waiting.get(c.id) ?? 0, landed: landed.get(c.id) ?? 0 }))
    .sort((a, b) => order(a) - order(b) || b.waiting + b.landed - (a.waiting + a.landed) || a.name.localeCompare(b.name));
  return { ok: true, only: conn.metaOnlyCampaigns, picked: conn.metaCampaignIds, campaigns, note };
}

/** Save which campaigns this Page takes. */
export async function saveCampaigns(connectionId: unknown, only: unknown, picked: unknown): Promise<{ ok: true; message: string } | Fail> {
  const member = await manager();
  if (!member) return REFUSED;
  if (typeof connectionId !== 'string') return { ok: false, error: 'That connection is not yours.' };
  const takeAll = only !== true;
  const list = cleanCampaignPick(picked);
  if (!takeAll && list.length === 0) return { ok: false, error: 'Pick at least one campaign, or choose every campaign.' };
  const { count } = await prisma.studioLeadConnection.updateMany({
    where: { id: connectionId, studioId: member.studioId, kind: 'META_PAGE' },
    data: {
      metaOnlyCampaigns: !takeAll,
      metaCampaignIds: takeAll ? [] : list.map((c) => c.id),
      metaCampaigns: takeAll ? Prisma.DbNull : (list as unknown as Prisma.InputJsonValue),
    },
  });
  if (count === 0) return { ok: false, error: 'That connection is not yours.' };
  await prisma.auditLog.create({
    data: { actorId: member.userId, action: 'studio.meta.campaigns', entityType: 'StudioLeadConnection', entityId: connectionId, after: { all: takeAll, campaigns: list.map((c) => c.id) } },
  });
  return { ok: true, message: takeAll ? 'Saved: leads from every campaign come in.' : `Saved: leads from ${list.length} campaign${list.length === 1 ? '' : 's'} come in. Others are kept aside.` };
}
