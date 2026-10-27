'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { siteUrlForHost } from '@/lib/site';
import { TEAM_PATH } from '@/modules/studio/surfaces';
import {
  inviteMember,
  reinstateMember,
  resendInvite,
  setDesignHead,
  setMemberSites,
  setTemporaryPassword,
  signOutEverywhere,
  suspendMember,
  type TeamResult,
} from '@/modules/studio/team-store';
import { createSalesRole, deleteSalesRole, setMemberSalesRole, setReportsTo, updateSalesRole, type SalesTeamResult } from '@/modules/studio/sales-team-store';

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

export async function inviteAction(input: { name: string; phone: string; role: string; sites: string[]; salesRoleId?: string; reportsToId?: string }): Promise<TeamResult> {
  return done(inviteMember(input, await baseUrl()));
}

/*
 * Sales roles and teams (owner, 22 Oct 2026): the Roles tab, each
 * salesperson's role and reporting line. The checks (owner or
 * `team.sales`, same studio, no loops) are in sales-team-store.ts.
 */

export async function createRoleAction(input: { name: string; description: string; permissions: Record<string, unknown> }): Promise<SalesTeamResult> {
  return done(createSalesRole(input));
}

export async function updateRoleAction(roleId: string, input: { name: string; description: string; permissions: Record<string, unknown> }): Promise<SalesTeamResult> {
  return done(updateSalesRole(String(roleId), input));
}

export async function deleteRoleAction(roleId: string): Promise<SalesTeamResult> {
  return done(deleteSalesRole(String(roleId)));
}

export async function setSalesRoleAction(memberId: string, roleId: string | null): Promise<SalesTeamResult> {
  return done(setMemberSalesRole(String(memberId), typeof roleId === 'string' ? roleId : null));
}

export async function setReportsToAction(memberId: string, bossId: string | null): Promise<SalesTeamResult> {
  return done(setReportsTo(String(memberId), typeof bossId === 'string' ? bossId : null));
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

export async function setPasswordAction(memberId: string): Promise<TeamResult> {
  return done(setTemporaryPassword(String(memberId)));
}

export async function setDesignHeadAction(memberId: string, on: boolean): Promise<TeamResult> {
  return done(setDesignHead(String(memberId), on === true));
}
