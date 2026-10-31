import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeNext } from '@/lib/site';
import { getCurrentUser } from '@/modules/auth/session';
import { PasswordForm } from './PasswordForm';

export const metadata: Metadata = { title: 'Choose your password', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** After a one-time password (owner, 1 Nov 2026): the client chooses their own before anything else. */
export default async function AppPassword({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (!(await getCurrentUser())) redirect('/app/sign-in');
  const to = safeNext(next ?? null);
  return (
    <div className="oa-frame">
      <PasswordForm next={to && to.startsWith('/app/') ? to : '/app/home'} />
    </div>
  );
}
