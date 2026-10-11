'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { siteUrlForHost } from '@/lib/site';
import { TEAM_PATH } from '@/modules/studio/surfaces';
import {
  inviteMember,
  reinstateMember,
  resendInvite,
  setMemberSites,
  signOutEverywhere,
  suspendMember,
  type TeamResult,
} from '@/modules/studio/team-store';

/**
 * Settings → Team. Each action is a thin call: the `team.manage` check is in
 * `team-store.ts`, through `assertCan`, so calling one of these directly as a
 * project manager is refused there.
 */

async function baseUrl(): Promise<string> {
  /* The host they are on, so the invite link opens the studio host the
     session cookie belongs to (sessions are host-only). */
  return siteUrlForHost((await headers()).get('host'));
}

async function done(r: Promise<TeamResult>): Promise<TeamResult> {
  try {
    const result = await r;
    if (result.ok) revalidatePath(TEAM_PATH);
    return result;
  } catch (error) {
    console.error('[team] action failed', error);
    return { ok: false, error: 'That did not save. Try again.' };
  }
}

export async function inviteAction(input: { name: string; phone: string; role: string; sites: string[] }): Promise<TeamResult> {
  return done(inviteMember(input, await baseUrl()));
}

export async function resendAction(memberId: string): Promise<TeamResult> {
  return done(resendInvite(String(memberId), await baseUrl()));
}

export async function suspendAction(memberId: string): Promise<TeamResult> {
  return done(suspendMember(String(memberId)));
}

export async function reinstateAction(memberId: string): Promise<TeamResult> {
  return done(reinstateMember(String(memberId)));
}

export async function signOutEverywhereAction(memberId: string): Promise<TeamResult> {
  return done(signOutEverywhere(String(memberId)));
}

export async function setSitesAction(memberId: string, sites: string[]): Promise<TeamResult> {
  return done(setMemberSites(String(memberId), sites));
}
