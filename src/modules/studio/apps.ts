/**
 * The studio's apps: what each role's home and apps menu show, and which app a
 * `/studio` path belongs to (docs/studio-os/UI-REBUILD.md; the owner's UI
 * handoff of 12 Oct 2026). Pure; tests/studio-apps.test.ts pins it.
 *
 * ## Shown is not allowed
 *
 * An app is listed for a member only when `mayOpen` lets them open its first
 * page, so this file can never show a tile for a screen the layout would bounce.
 * It is the menu, not the lock: the module layer still decides what each screen
 * reads (money stays hidden from designers and project managers there).
 */

import { asSeenBy, can, type MemberRole, type StudioRoleName } from './roles';
import { CREWS_HOME, DESIGN_HOME, DOCUMENTS_HOME, LEAD_SETTINGS_PATHS, PAYMENTS_HOME, SITE_HOME, STUDIO_HOME, TEAM_PATH, TODAY_HOME, mayOpen } from './surfaces';

export { STUDIO_HOME };

export type AppKey =
  | 'today' | 'clients' | 'quotes' | 'projects' | 'documents' | 'site' | 'money'
  | 'vendors' | 'calendar' | 'chats' | 'intros' | 'rates' | 'team';

export type AppIconName =
  | 'home' | 'users' | 'file' | 'layers' | 'camera' | 'rupee'
  | 'truck' | 'calendar' | 'inbox' | 'box' | 'gear' | 'chat';

export interface AppTab {
  label: string;
  href: string;
  /** Owner-only and the like: the tab shows only when `mayOpen` lets them in. */
  /** A number on the tab (To build: the quotation requests waiting for them). Set by the layout. */
  count?: number;
}

/**
 * Quotations → To build (quotation requests, owner 22 Oct 2026; docs/studio-os/
 * QUOTE-REQUESTS.md): for whoever builds quotations, and the heads who hand
 * requests over (owner, PM, a sales role that gives leads to people).
 */
export const TO_BUILD_PATH = '/studio/quotations/requests';

/** Tabs shown only to some of the people who may open the app. */
function tabFor(member: MemberRole, href: string): boolean {
  if (href === TO_BUILD_PATH) return can(member, 'quote.build') || can(member, 'lead.assign');
  return true;
}

export interface StudioApp {
  key: AppKey;
  name: string;
  href: string;
  icon: AppIconName;
  /** Tile colours, as token names from the design (`var(--…)`). */
  bg: string;
  fg: string;
  tabs: AppTab[];
  /** Path prefixes that belong to this app (the header shows its name and tabs). */
  owns: string[];
}

const T = (label: string, href: string): AppTab => ({ label, href });

/** In the owner's order (StudioLauncher). */
export const APPS: readonly StudioApp[] = [
  {
    key: 'today', name: 'Today', href: TODAY_HOME, icon: 'home', bg: 'var(--ink)', fg: 'var(--paper)',
    tabs: [T('Your list', TODAY_HOME), T('Overview', '/studio')],
    owns: [TODAY_HOME],
  },
  {
    key: 'clients', name: 'Clients', href: '/studio/clients', icon: 'users', bg: 'var(--acc-soft)', fg: 'var(--acc-ink)',
    tabs: [
      T('All clients', '/studio/clients'),
      T('Pool', '/studio/clients/pool'),
      T('Numbers', '/studio/dashboard'),
      T('Import', '/studio/clients/import'),
      T('Analytics', '/studio/clients/analytics'),
      T('Bin', '/studio/clients/bin'),
    ],
    owns: ['/studio/clients', '/studio/dashboard'],
  },
  {
    key: 'quotes', name: 'Quotations', href: '/studio/quotations', icon: 'file', bg: 'var(--info-bg)', fg: 'var(--info)',
    /* Hauspire's top bar (owner, 13 Oct 2026): First Quote, Full Builder, My
       Quotations, Products, Terms (Electrical and Elec Rates left out by the
       owner). Products is the product master, so the header stays on
       Quotations there; the Product master tile still opens it. */
    tabs: [
      T('First Quote', '/studio/quotations/first'),
      T('Full Builder', '/studio/quotations/builder'),
      T('My Quotations', '/studio/quotations'),
      T('To build', TO_BUILD_PATH),
      T('Products', '/studio/products'),
      T('Terms', '/studio/quotations/terms'),
    ],
    owns: ['/studio/quotations', '/studio/products'],
  },
  {
    key: 'projects', name: 'Projects', href: '/studio/projects', icon: 'layers', bg: 'var(--good-bg)', fg: 'var(--good)',
    tabs: [T('All projects', '/studio/projects'), T('Design', DESIGN_HOME), T('Start a project', '/studio/projects/start')],
    owns: ['/studio/projects', DESIGN_HOME, '/studio/updates'],
  },
  {
    /* Project documents (owner and Hauspire's design team, 24 Oct 2026; DESIGN-PROCESS-PLAN.md §3.4): a folder per project. */
    key: 'documents', name: 'Documents', href: DOCUMENTS_HOME, icon: 'file', bg: 'var(--warn-bg)', fg: 'var(--warn)',
    tabs: [],
    owns: [DOCUMENTS_HOME],
  },
  {
    key: 'site', name: 'Site', href: SITE_HOME, icon: 'camera', bg: 'var(--ink)', fg: 'var(--paper)',
    tabs: [],
    owns: [SITE_HOME],
  },
  {
    key: 'money', name: 'Money', href: PAYMENTS_HOME, icon: 'rupee', bg: 'var(--good-bg)', fg: 'var(--good)',
    tabs: [T('Payments desk', PAYMENTS_HOME)],
    owns: [PAYMENTS_HOME],
  },
  {
    key: 'vendors', name: 'Vendors', href: CREWS_HOME, icon: 'truck', bg: 'var(--fill)', fg: 'var(--text2)',
    tabs: [
      T('Crews', CREWS_HOME),
      T('Pay crews', `${CREWS_HOME}/pay`),
      T('Payments', `${CREWS_HOME}/payments`),
      T('Rates', `${CREWS_HOME}/price`),
      T('Labour', `${CREWS_HOME}/labour`),
    ],
    owns: [CREWS_HOME],
  },
  {
    key: 'calendar', name: 'Calendar', href: '/studio/calendar', icon: 'calendar', bg: 'var(--info-bg)', fg: 'var(--info)',
    tabs: [T('Calendar', '/studio/calendar'), T('Meetings', '/studio/calendar/meetings'), T('One Interiors visits', '/studio/calendar/appointments')],
    owns: ['/studio/calendar'],
  },
  {
    /* In-app chat with clients (owner, 1 Nov 2026; modules/chat). */
    key: 'chats', name: 'Chats', href: '/studio/chats', icon: 'chat', bg: 'var(--good-bg, #e5f4e4)', fg: 'var(--good, #2e7d32)',
    tabs: [T('Chats', '/studio/chats')],
    owns: ['/studio/chats'],
  },
  {
    key: 'intros', name: 'From One Interiors', href: '/studio/listing', icon: 'inbox', bg: 'var(--acc)', fg: '#FFFFFF',
    tabs: [T('Your listing', '/studio/listing'), T('Client projects', '/studio/updates'), T('Profile', '/studio/profile')],
    owns: ['/studio/listing', '/studio/profile', '/studio/onboarding'],
  },
  {
    key: 'rates', name: 'Product master', href: '/studio/products', icon: 'box', bg: 'var(--fill)', fg: 'var(--text2)',
    tabs: [T('Products', '/studio/products'), T('Rate card', '/studio/rates')],
    /* The products page itself is a Quotations tab (13 Oct 2026); this app owns the rate card. */
    owns: ['/studio/rates'],
  },
  {
    key: 'team', name: 'Team', href: TEAM_PATH, icon: 'gear', bg: 'var(--fill)', fg: 'var(--text2)',
    tabs: [T('Team', TEAM_PATH), T('Settings', '/studio/settings')],
    owns: ['/studio/settings'],
  },
];

/**
 * Each role's apps, in the order their home shows them (the brief's table,
 * plus what our roles already open: a project manager keeps the office they had).
 */
const ROLE_APPS: Record<StudioRoleName, readonly AppKey[]> = {
  OWNER: ['today', 'clients', 'quotes', 'projects', 'chats', 'documents', 'site', 'money', 'vendors', 'calendar', 'intros', 'rates', 'team'],
  /* Sales roles (owner, 22 Oct 2026): Team / Settings shows only when their sales role opens it (`mayOpen`). */
  SALES: ['clients', 'quotes', 'calendar', 'team'],
  /* The design meeting (24 Oct 2026): a designer reaches the design final from the project, not a Quotations tile. */
  DESIGNER: ['projects', 'chats', 'documents', 'vendors', 'calendar'],
  PM: ['projects', 'chats', 'documents', 'vendors', 'quotes', 'today', 'clients', 'site', 'calendar', 'rates', 'team'],
  ACCOUNTS: ['money', 'vendors', 'quotes', 'calendar'],
  /* Office meetings (owner, 27 Oct 2026): everyone has the calendar. A supervisor reaches it from site mode. */
  SUPERVISOR: ['site', 'chats', 'calendar'],
};

function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Where an app opens for this member. A designer's Projects is their design
 * page; a project manager's Team is the settings they may change.
 */
function entryFor(app: StudioApp, member: MemberRole): string {
  if (app.key === 'projects' && member.role === 'DESIGNER') return DESIGN_HOME;
  if (app.key === 'team' && member.role === 'SALES') return can(member, 'team.sales') && member.solo !== true ? TEAM_PATH : LEAD_SETTINGS_PATHS[0]!;
  if (app.key === 'team' && (!can(member, 'team.manage') || member.solo === true)) return '/studio/settings';
  return app.href;
}

/** The apps this member's home and apps menu show, each pointed at where it opens for them. */
export function appsFor(viewer: MemberRole): StudioApp[] {
  /* Staff viewing as this member (VIEW-AS.md) see their apps exactly. */
  const member = asSeenBy(viewer);
  if (member.status !== 'ACTIVE') return [];
  const byKey = new Map(APPS.map((a) => [a.key, a]));
  const out: StudioApp[] = [];
  for (const key of ROLE_APPS[member.role]) {
    const app = byKey.get(key);
    if (!app) continue;
    const href = entryFor(app, member);
    if (!mayOpen(member, href)) continue;
    const tabs = app.tabs.filter((t) => mayOpen(member, t.href) && tabFor(member, t.href));
    out.push({ ...app, href, tabs, name: app.key === 'clients' && member.role === 'SALES' ? 'Leads' : app.key === 'team' && href !== TEAM_PATH ? 'Settings' : app.name });
  }
  return out;
}

/**
 * The apps this member would have with the full software but does not
 * because their studio is not a pilot (owner, 14 Oct 2026): the owner's home
 * shows them greyed as "Coming soon", never as links. Empty for every studio
 * on the full software, and for the roles that need it (their home says so).
 */
export function comingSoonApps(member: MemberRole): StudioApp[] {
  if (member.status !== 'ACTIVE' || member.fullSoftware !== false || member.role !== 'OWNER') return [];
  const open = new Set(appsFor(member).map((a) => a.key));
  const full = new Set(appsFor({ ...member, fullSoftware: true }).map((a) => a.key));
  return APPS.filter((a) => full.has(a.key) && !open.has(a.key));
}

/**
 * The app a path belongs to, or null (the home, sign-in). Longest prefix wins,
 * so `/studio/calendar/appointments` is Calendar and `/studio` alone is nothing.
 */
export function appForPath(path: string, apps: readonly StudioApp[] = APPS): StudioApp | null {
  /* The studio overview is Today's second tab; nothing else is "/studio" itself. */
  if (path === '/studio' || path === '/studio/') return apps.find((a) => a.key === 'today') ?? null;
  let best: { app: StudioApp; len: number } | null = null;
  for (const app of apps) {
    /* What each app OWNS, not its entry page: the Product master opens
       `/studio/products`, which belongs to Quotations (13 Oct 2026). Every
       app owns its own entry otherwise. */
    for (const p of app.owns) {
      if (under(path, p) && (!best || p.length > best.len)) best = { app, len: p.length };
    }
  }
  return best?.app ?? null;
}

/** The tab a path is on: the longest tab href it sits under. */
export function tabForPath(path: string, tabs: readonly AppTab[]): AppTab | null {
  let best: AppTab | null = null;
  for (const t of tabs) {
    if (under(path, t.href) && (!best || t.href.length > best.href.length)) best = t;
  }
  return best;
}
