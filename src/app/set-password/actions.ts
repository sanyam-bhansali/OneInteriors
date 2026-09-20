'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/modules/auth/session';
import { setOwnPassword } from '@/modules/auth/password-signin';
import { canUsePassword } from '@/modules/auth/password';

export interface SecurityState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
}

/**
 * Set or change your own password. Studios and ops share this.
 *
 * A layout guard protects rendering, not mutation — a server action is
 * directly invocable — so this re-reads the session and the role itself.
 */
export async function setPasswordAction(
  _prev: SecurityState,
  formData: FormData,
): Promise<SecurityState> {
  const user = await getCurrentUser();
  if (!user || !canUsePassword(user.role)) {
    /* Customers reach this by URL only, and the honest answer is that their
       account does not use one — not that they got something wrong. */
    return {
      status: 'error',
      message: 'This account signs in by link, not by password.',
    };
  }

  const next = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const current = String(formData.get('current') ?? '') || null;

  /* Checked before the strength rules, so somebody who mistyped the second box
     is told that, rather than being lectured about length. */
  if (next !== confirm) {
    return { status: 'error', message: 'The two passwords do not match.' };
  }

  const result = await setOwnPassword(user.id, next, current);
  if (!result.ok) return { status: 'error', message: result.message };

  revalidatePath('/set-password');

  /* Straight on to the work. Leaving them on a settings screen that says
     "saved" makes setting a password feel like an errand rather than the last
     step of getting in. Only ever an in-app path — see the page, which refuses
     anything that is not relative. */
  const onward = String(formData.get('next') ?? '');
  if (onward.startsWith('/') && !onward.startsWith('//')) redirect(onward);

  return {
    status: 'ok',
    message: 'Password set. It works on the sign-in page from now on.',
  };
}
