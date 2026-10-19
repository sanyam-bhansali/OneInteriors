/**
 * The profile menu (owner, 12 Oct 2026): who is signed in, their role and
 * what it lets them do, and their own home settings. Reads and writes the
 * signed-in member's own row only; there is no way to name another member.
 */

import type { Prisma } from '@prisma/client';
import { SOFTWARE_PLANS, planOf } from './software-plan';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/modules/auth/session';
import { currentMember } from './access';
import { appsFor, type AppIconName, type AppKey } from './apps';
import { fitHomePrefs, landingHref, orderedApps, parseHomePrefs, type HomePrefs } from './home-prefs';
import { ROLE_NAMES, lastActive, languageName, roleCan, siteLabel } from './team-rules';
import type { StudioRoleName } from './roles';

/** What the role is, said to the person themselves (Settings → Team says it to the owner). */
const ROLE_SELF: Record<StudioRoleName, string> = {
  OWNER: 'Everything in the studio: the team, prices, margins and money.',
  PM: 'The plan, decisions, snags and crews’ work on the projects you are on. You see quantities, never crew rates or payments.',
  SALES: 'Your own leads and the pool: calls, floor plans, quotations and the sales final.',
  DESIGNER: 'The design of the projects you are the designer on: steps, drawings, mood board and site visits. No money.',
  ACCOUNTS: 'Payments and receipts across every project, the booking advance, and paying the crews.',
  SUPERVISOR: 'Your sites on the phone: the daily update, the checklist and snags.',
};

export interface ProfileApp {
  key: AppKey;
  name: string;
  icon: AppIconName;
  bg: string;
  fg: string;
}

export interface Profile {
  name: string | null;
  phone: string | null;
  email: string | null;
  language: string;
  role: StudioRoleName;
  roleName: string;
  roleLine: string;
  can: string[];
  studio: string;
  verified: boolean;
  /** The studio software plan's name: Pro or Max (owner, 19 Oct 2026). */
  planName: string;
  memberSince: string;
  lastActive: string | null;
  /** The sites picked for them (PM, supervisor); null when they see the whole studio. */
  sites: string[] | null;
  /** Their apps in their chosen order, and their home settings. */
  apps: ProfileApp[];
  prefs: HomePrefs;
}

const SEES_PICKED: readonly StudioRoleName[] = ['PM', 'SUPERVISOR'];

export async function myProfile(): Promise<Profile | null> {
  const [user, member] = await Promise.all([getCurrentUser(), currentMember()]);
  if (!user || !member || member.status !== 'ACTIVE') return null;
  const row = await prisma.studioMember.findUnique({
    where: { id: member.id },
    select: {
      createdAt: true,
      lastSeenAt: true,
      homePrefs: true,
      studio: { select: { tradeName: true, status: true, softwarePlan: true, fullSoftware: true } },
      user: { select: { name: true, phone: true, email: true, locale: true } },
      projects: {
        select: { homeProject: { select: { introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true } } } } } } },
        take: 50,
      },
    },
  });
  if (!row) return null;
  const apps = appsFor(member);
  const prefs = fitHomePrefs(parseHomePrefs(row.homePrefs), apps);
  return {
    name: row.user.name?.trim() || null,
    phone: row.user.phone,
    email: row.user.email,
    language: languageName(row.user.locale),
    role: member.role,
    roleName: member.role === 'OWNER' ? 'Owner and admin' : ROLE_NAMES[member.role],
    roleLine: ROLE_SELF[member.role],
    can: roleCan(member.role),
    studio: row.studio.tradeName,
    verified: row.studio.status === 'ACTIVE',
    planName: SOFTWARE_PLANS[planOf(row.studio)].name,
    memberSince: row.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }),
    lastActive: lastActive(row.lastSeenAt),
    sites: SEES_PICKED.includes(member.role) ? row.projects.map((p) => siteLabel(p.homeProject.introduction?.brief ?? null)) : null,
    apps: orderedApps(apps, prefs).map((a) => ({ key: a.key, name: a.name, icon: a.icon, bg: a.bg, fg: a.fg })),
    prefs,
  };
}

/** Save the signed-in member's own home settings, fitted to the apps they have. */
export async function saveMyHomePrefs(raw: unknown): Promise<{ ok: true; prefs: HomePrefs } | { ok: false; error: string }> {
  const member = await currentMember();
  if (!member || member.status !== 'ACTIVE') return { ok: false, error: 'Sign in again to change your settings.' };
  const prefs = fitHomePrefs(parseHomePrefs(raw), appsFor(member));
  await prisma.studioMember.update({ where: { id: member.id }, data: { homePrefs: prefs as unknown as Prisma.InputJsonValue } });
  return { ok: true, prefs };
}

/** The signed-in member's home settings (the home page and sign-in read these). */
export async function myHomePrefs(memberId: string): Promise<HomePrefs> {
  const row = await prisma.studioMember.findUnique({ where: { id: memberId }, select: { homePrefs: true } }).catch(() => null);
  return parseHomePrefs(row?.homePrefs ?? null);
}

/** Where this member lands after signing in: their chosen app, if they still may open it, else their home. */
export async function landingFor(member: { id: string; role: StudioRoleName; status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' }, fallback: string): Promise<string> {
  if (member.role === 'SUPERVISOR' || member.status !== 'ACTIVE') return fallback;
  const apps = appsFor(member);
  return landingHref(apps, fitHomePrefs(await myHomePrefs(member.id), apps));
}
