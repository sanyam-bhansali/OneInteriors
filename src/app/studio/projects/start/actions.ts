'use server';

import { revalidatePath } from 'next/cache';
import { currentMember } from '@/modules/studio/access';
import { resendOwnInvite, startOwnProject } from '@/modules/project/own-project';
import { setClientOneTimePassword } from '@/modules/auth/customer-password';

/**
 * "Start a project" for the studio's own client
 * (docs/studio-workspace/OWN-CLIENTS.md). Everything is checked in the
 * module: `project.create` (owner or PM), the quotation is this studio's own
 * client's and accepted, the customer's number is not a team account.
 */
export async function startOwnProjectAction(form: FormData): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const s = (k: string) => String(form.get(k) ?? '').slice(0, 200);
  const r = await startOwnProject(await currentMember(), {
    quoteId: s('quoteId'),
    startOn: s('startOn'),
    totalDays: s('totalDays'),
    designDays: s('designDays'),
    customer: { name: s('name'), phone: s('phone'), email: s('email') },
  });
  if (!r.ok) return r;
  revalidatePath('/studio/projects');
  revalidatePath('/studio/quotations');
  return { ok: true, projectId: r.projectId };
}

/** Send the invite again with a fresh link (the old one stops working). */
export async function resendInviteAction(projectId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await resendOwnInvite(await currentMember(), String(projectId).slice(0, 64));
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(`/studio/projects/${projectId}`);
  return { ok: true };
}

/** A one-time password for the client to sign in to the app with (owner, 1 Nov 2026); shown once, handed over by the studio. */
export async function clientPasswordAction(projectId: string): Promise<{ ok: true; password: string; message: string } | { ok: false; error: string }> {
  return setClientOneTimePassword(String(projectId).slice(0, 64));
}
