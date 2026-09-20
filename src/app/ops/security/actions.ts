'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/modules/auth/session';
import { setOwnPassword } from '@/modules/auth/password-signin';

export interface SecurityState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
}

/**
 * Set or change your own ops password.
 *
 * A layout guard protects rendering, not mutation — a server action is
 * directly invocable — so this re-reads the session and the role itself.
 */
export async function setPasswordAction(
  _prev: SecurityState,
  formData: FormData,
): Promise<SecurityState> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'OPS') {
    return { status: 'error', message: 'Sign in as an ops account first.' };
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

  revalidatePath('/ops/security');
  return {
    status: 'ok',
    message: 'Password set. It works on the sign-in page from now on.',
  };
}
