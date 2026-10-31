import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeNext } from '@/lib/site';
import { getCurrentUser } from '@/modules/auth/session';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** The clients' sign-in (owner, 1 Nov 2026). Signed in already: carry on to where they were going. */
export default async function AppSignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const to = safeNext(next ?? null);
  const dest = to && to.startsWith('/app/') ? to : '/app/home';
  if (await getCurrentUser()) redirect(dest);
  return (
    <div className="oa-frame">
      <SignInForm next={dest} />
    </div>
  );
}
