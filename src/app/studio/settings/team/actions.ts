'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { siteUrlForHost } from '@/lib/site';
import { TEAM_PATH } from '@/modules/studio/surfaces';
import {
  inviteMember,
  reinstateMember,
  resendInvite,
  setDesignHead,
  setDirector,
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

export async function inviteAction(input: { name: string; phone: string; email?: string; role: string; sites: string[]; salesRoleId?: string; reportsToId?: string; director?: boolean }): Promise<TeamResult> {
  return guarded('inviteAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(inviteMember(input, await baseUrl()));
});
}

/*
 * Sales roles and teams (owner, 22 Oct 2026): the Roles tab, each
 * salesperson's role and reporting line. The checks (owner or
 * `team.sales`, same studio, no loops) are in sales-team-store.ts.
 */

export async function createRoleAction(input: { name: string; description: string; permissions: Record<string, unknown> }): Promise<SalesTeamResult> {
  return guarded('createRoleAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(createSalesRole(input));
});
}

export async function updateRoleAction(roleId: string, input: { name: string; description: string; permissions: Record<string, unknown> }): Promise<SalesTeamResult> {
  return guarded('updateRoleAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(updateSalesRole(String(roleId), input));
});
}

export async function deleteRoleAction(roleId: string): Promise<SalesTeamResult> {
  return guarded('deleteRoleAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(deleteSalesRole(String(roleId)));
});
}

export async function setSalesRoleAction(memberId: string, roleId: string | null): Promise<SalesTeamResult> {
  return guarded('setSalesRoleAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(setMemberSalesRole(String(memberId), typeof roleId === 'string' ? roleId : null));
});
}

export async function setReportsToAction(memberId: string, bossId: string | null): Promise<SalesTeamResult> {
  return guarded('setReportsToAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(setReportsTo(String(memberId), typeof bossId === 'string' ? bossId : null));
});
}

export async function resendAction(memberId: string): Promise<TeamResult> {
  return guarded('resendAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(resendInvite(String(memberId), await baseUrl()));
});
}

export async function suspendAction(memberId: string): Promise<TeamResult> {
  return guarded('suspendAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(suspendMember(String(memberId)));
});
}

export async function reinstateAction(memberId: string): Promise<TeamResult> {
  return guarded('reinstateAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(reinstateMember(String(memberId)));
});
}

export async function signOutEverywhereAction(memberId: string): Promise<TeamResult> {
  return guarded('signOutEverywhereAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(signOutEverywhere(String(memberId)));
});
}

export async function setSitesAction(memberId: string, sites: string[]): Promise<TeamResult> {
  return guarded('setSitesAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(setMemberSites(String(memberId), sites));
});
}

export async function setPasswordAction(memberId: string): Promise<TeamResult> {
  return guarded('setPasswordAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(setTemporaryPassword(String(memberId)));
});
}

export async function setDesignHeadAction(memberId: string, on: boolean): Promise<TeamResult> {
  return guarded('setDesignHeadAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(setDesignHead(String(memberId), on === true));
});
}

/** Director (owner, 24 Nov 2026): projects first, leads and quotations read only. */
export async function setDirectorAction(memberId: string, on: boolean): Promise<TeamResult> {
  return guarded('setDirectorAction', { ok: false, error: SAVE_FAILED }, async () => {
  return done(setDirector(String(memberId), on === true));
});
}
