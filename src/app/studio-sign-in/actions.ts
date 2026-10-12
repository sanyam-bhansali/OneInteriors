'use server';

import { headers } from 'next/headers';
import { hasDatabase } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { requestOtp, verifyOtp } from '@/modules/auth/otp';
import { getCurrentUser, signOut } from '@/modules/auth/session';
import { asLang } from '@/modules/i18n/site';
import { localeFor, type StudioWord } from '@/modules/i18n/studio';
import { currentMember, memberFor } from '@/modules/studio/access';
import type { StudioRoleName } from '@/modules/studio/roles';
import { homeFor } from '@/modules/studio/surfaces';
import { landingFor } from '@/modules/studio/profile';
import { myToday } from '@/modules/studio-sales/today';
import type { SectionId } from '@/modules/studio-sales/today-rules';
import { designWorkload } from '@/modules/studio-design/store';
import { mySitesToday } from '@/modules/project/site-log';
import { record } from '@/modules/analytics/record';
import { asPicked, roleMismatch } from './pick';

/**
 * The studio phone sign-in (/studio/sign-in). Same codes, same challenge
 * table and same sessions as the customer's (`auth/otp.ts`), with the
 * `studio` option: only a number on a studio's team gets a code, and
 * signing in never creates an account.
 *
 * Errors come back as word keys, so the page says them in the language the
 * person picked (modules/i18n/studio.ts).
 *
 * The role picked on the page's first step (the owner's UI handoff) only
 * travels here to be compared: where the person lands is always
 * `homeFor(their real role)`, and a different pick is reported back so the
 * page can show "{Studio} added you as {Real}, not {Picked}". Picking a role
 * never grants anything.
 */

export type StudioCodeResult = { ok: true; devCode?: string } | { ok: false; error: StudioWord };
export type StudioVerifyResult =
  | { ok: true; to: string; role: StudioRoleName; mismatch: boolean; studio: string | null }
  | { ok: false; error: StudioWord };

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

export async function requestStudioCodeAction(phone: string): Promise<StudioCodeResult> {
  if (!hasDatabase()) return { ok: false, error: 'err.unavailable' };
  try {
    const r = await requestOtp(String(phone).slice(0, 20), '', { ip: await clientIp(), studio: true });
    if (r.ok) return r.devCode ? { ok: true, devCode: r.devCode } : { ok: true };
    return { ok: false, error: r.reason === 'invalid_name' ? 'err.invalid_phone' : `err.${r.reason}` };
  } catch (error) {
    console.error('[studio-sign-in] requestOtp threw:', error);
    return { ok: false, error: 'err.unavailable' };
  }
}

export async function verifyStudioCodeAction(phone: string, code: string, lang: string, picked?: string | null): Promise<StudioVerifyResult> {
  if (!hasDatabase()) return { ok: false, error: 'err.unavailable' };
  const h = await headers();
  try {
    const r = await verifyOtp(String(phone).slice(0, 20), String(code).slice(0, 40), null, {
      studio: true,
      locale: localeFor(asLang(lang)),
      userAgent: h.get('user-agent'),
      ip: await clientIp(),
    });
    if (!r.ok) return { ok: false, error: `err.${r.reason}` };
    await record('signin.completed');
    const role = r.studioRole ?? 'OWNER';
    const member = await memberFor(r.userId).catch(() => null);
    const studio = member
      ? ((await prisma.studio.findUnique({ where: { id: member.studioId }, select: { tradeName: true } }).catch(() => null))?.tradeName ?? null)
      : null;
    /* Their own "after signing in, open" choice (profile menu), if they still may open it. */
    const to = member ? await landingFor(member, homeFor(role)).catch(() => homeFor(role)) : homeFor(role);
    return { ok: true, to, role, mismatch: roleMismatch(asPicked(picked), role), studio };
  } catch (error) {
    console.error('[studio-sign-in] verifyOtp threw:', error);
    return { ok: false, error: 'err.unavailable' };
  }
}

export type WaitingWord = 'calls' | 'quotes' | 'meetings' | 'tasks' | 'projects' | 'steps' | 'late' | 'sites' | 'snags';

export interface Welcome {
  name: string | null;
  studio: string | null;
  role: StudioRoleName;
  to: string;
  waiting: { word: WaitingWord; n: number }[];
}

/**
 * "Welcome back, {name}" with what is waiting on their home. Runs after
 * sign-in, as the member, through the same scoped reads their home uses
 * (a salesperson's own leads, a designer's own projects, a supervisor's own
 * sites), so it can never count what they may not see.
 */
export async function welcomeAction(): Promise<Welcome | null> {
  const [user, member] = await Promise.all([getCurrentUser(), currentMember()]);
  if (!user || !member || member.status !== 'ACTIVE') return null;
  const studio = (await prisma.studio.findUnique({ where: { id: member.studioId }, select: { tradeName: true } }).catch(() => null))?.tradeName ?? null;
  const waiting: Welcome['waiting'] = [];
  const add = (word: WaitingWord, n: number) => {
    if (n > 0) waiting.push({ word, n });
  };
  try {
    if (member.role === 'SALES' || member.role === 'PM' || member.role === 'OWNER') {
      const today = await myToday();
      const n = (id: SectionId) => {
        const s = today?.sections.find((x) => x.id === id);
        return s ? s.rows.length + s.more : 0;
      };
      add('calls', n('calls'));
      add('quotes', n('quotes'));
      add('meetings', n('meetings'));
      add('tasks', n('tasks'));
    } else if (member.role === 'DESIGNER') {
      const w = await designWorkload();
      const projects = w?.designers.flatMap((d) => d.projects) ?? [];
      add('projects', projects.length);
      add('steps', projects.reduce((a, p) => a + p.due, 0));
      add('late', projects.reduce((a, p) => a + p.late, 0));
    } else if (member.role === 'SUPERVISOR') {
      const sites = await mySitesToday();
      add('sites', sites?.cards.length ?? 0);
      add('snags', sites?.cards.reduce((a, c) => a + c.openSnags, 0) ?? 0);
    }
  } catch (error) {
    console.error('[studio-sign-in] welcome read failed', error instanceof Error ? error.name : 'unknown');
  }
  const first = (user.name ?? '').trim().split(/\s+/)[0] || null;
  const to = await landingFor(member, homeFor(member.role)).catch(() => homeFor(member.role));
  return { name: first, studio, role: member.role, to, waiting: waiting.slice(0, 3) };
}

/** "Pick again" on the mismatch card, and "Not you? Sign out": end this session and stay on the page. */
export async function pickAgainAction(): Promise<void> {
  await signOut();
}
