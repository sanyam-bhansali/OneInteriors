import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { canUsePassword } from '@/modules/auth/password';
import { SetPasswordForm } from './SetPasswordForm';

export const dynamic = 'force-dynamic';

/**
 * Where a password is set — and the only place.
 *
 * There is deliberately no seed script and no CLI flag. A password that
 * arrives through a script has been typed into a terminal, a chat, or a note
 * to yourself, and is compromised before it is ever used. The person who will
 * type it is the only one who should ever have seen it.
 *
 * ## Why this is the first screen after the approval email
 *
 * A studio's very first link is the one that tells them they are on the
 * roster, and it is the only moment we can be sure they are paying attention
 * to us. Asking for a password then costs them thirty seconds; asking later
 * means an email nobody opens. After this they sign in the ordinary way and
 * the link goes back to being what it should be — the way in when something
 * has gone wrong.
 *
 * It is skippable on purpose. A hard wall in front of somebody who came here
 * to read their approval, on a phone, between site visits, is a wall we would
 * be putting in our own funnel.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; first?: string }>;
}) {
  const { next, first } = await searchParams;
  const user = await getCurrentUser();

  if (!user) redirect('/sign-in?next=/set-password');
  if (!canUsePassword(user.role)) redirect('/');

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, passwordSetAt: true },
  });

  const hasPassword = row?.passwordHash != null;
  const isFirstTime = first === '1' && !hasPassword;
  const onward = next && next.startsWith('/') ? next : user.role === 'OPS' ? '/ops' : '/studio';

  return (
    <main className="mx-auto max-w-[760px] px-6 py-12">
      <p className="label m-0 mb-2">{isFirstTime ? 'One last thing' : 'Your account'}</p>
      <h1 className="m-0 mb-3 font-[family-name:var(--font-display)] text-[30px] leading-[1.15] tracking-[-.015em] text-[var(--color-ink)]">
        {hasPassword ? 'Change your password' : 'Choose a password'}
      </h1>

      <p className="m-0 mb-8 max-w-[54ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
        {isFirstTime ? (
          <>
            You are signed in. Set a password now and you can come straight back
            in next time with your email and this password — no waiting on an
            email. It takes about thirty seconds.
          </>
        ) : (
          <>
            A password lets you sign in directly instead of waiting for a link.
            The emailed link keeps working either way, which is how you get back
            in if you forget this.
          </>
        )}
      </p>

      <SetPasswordForm hasPassword={hasPassword} next={onward} />

      {isFirstTime ? (
        <p className="m-0 mt-6">
          <Link
            href={onward}
            className="text-[14px] text-[var(--color-ink-3)] underline underline-offset-4"
          >
            Skip for now — I&rsquo;ll keep using the emailed link
          </Link>
        </p>
      ) : null}

      <div className="mt-10 border-t border-[var(--color-rule)] pt-5">
        <p className="m-0 text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
          After five wrong attempts, password sign-in is switched off for this
          account and a sign-in link is emailed to you. Redeeming that link
          switches it back on. The lock has no timer on purpose — a timed lock
          is one an attacker simply waits out.
          {row?.passwordSetAt
            ? ` Last set ${row.passwordSetAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`
            : ''}
        </p>
      </div>
    </main>
  );
}
