'use server';

import { redirect } from 'next/navigation';
import { signOut } from '@/modules/auth/session';

/**
 * Someone else is signed in on this phone (a family member, the studio's own
 * login): sign them out, then sign in with the invited number. Going straight
 * to /sign-in would bounce back here, because sign-in sends a signed-in
 * person on to `next`.
 */
export async function switchNumberAction(code: string): Promise<void> {
  const clean = String(code ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 32);
  await signOut();
  redirect(`/sign-in?next=${encodeURIComponent(`/app/join/${clean}`)}`);
}
