import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { canUsePassword } from '@/modules/auth/password';
import { Wordmark } from '@/components/brand';
import { DoodleGround } from '@/components/oi/DoodleGround';
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
 *
 * ## Why it is a card on an empty page
 *
 * This was a 760px page of prose with a form at the bottom. That shape is
 * right for a settings screen you wandered into and wrong for the one screen
 * standing between somebody and the product: there is exactly one thing to do
 * here, so there is exactly one object on the page, and no navigation to
 * wander off through. The chrome is deliberately absent for the same reason.
 *
 * The lockout note stays, below the card rather than inside it. It is the one
 * piece of small print somebody is glad to have read afterwards, and hiding a
 * lockout rule until it fires is how support tickets are made.
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
    <div className="oi-tactile oi-quick relative min-h-screen">
      {/* Two washes rather than a flat ground: a warm one under the card and
          a cooler sage one at the far corner, both at low alpha. It reads as
          depth at a glance and as nothing at all if you look for it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1100px 620px at 50% -12%, rgba(192,97,60,.10), transparent 62%),' +
            'radial-gradient(760px 520px at 108% 106%, rgba(131,144,115,.12), transparent 60%)',
        }}
      />
      <DoodleGround className="text-[var(--ink)]" opacity={0.035} />

      <main className="relative mx-auto flex min-h-screen max-w-[520px] flex-col justify-center px-5 py-12">
        <div className="oi-card-in">
          <div className="mb-7 flex justify-center">
            <Link href="/" aria-label="One Interiors — home">
              <Wordmark showCity={false} className="text-[var(--color-ink)]" />
            </Link>
          </div>

          {/* 460px of content inside a 520px column. Narrower than the old
              760 on purpose: a password field the width of a paragraph
              invites a paragraph. */}
          <div className="rounded-[20px] border border-[var(--color-rule)] bg-[var(--card)] px-7 py-8 shadow-[0_1px_2px_rgba(44,38,36,.04),0_18px_44px_-26px_rgba(44,38,36,.28)] sm:px-9 sm:py-10">
            <p className="label m-0 mb-2 text-center">
              {isFirstTime ? 'One last thing' : 'Your account'}
            </p>
            <h1 className="m-0 mb-3 text-center text-[29px] leading-[1.15] font-bold tracking-[-.015em] text-[var(--color-ink)]">
              {hasPassword ? 'Change your password' : 'Choose a password'}
            </h1>

            <p className="m-0 mb-8 text-center text-[15px] leading-relaxed text-[var(--color-ink-2)]">
              {isFirstTime
                ? 'You are signed in. Set a password and you can come straight back next time — no waiting on an email. Thirty seconds.'
                : 'A password lets you sign in directly instead of waiting for a link. The emailed link keeps working either way.'}
            </p>

            <SetPasswordForm hasPassword={hasPassword} next={onward} />
          </div>

          {isFirstTime ? (
            <p className="m-0 mt-5 text-center">
              <Link
                href={onward}
                className="text-[14px] text-[var(--color-ink-2)] underline underline-offset-4 hover:text-[var(--color-ink)]"
              >
                Skip for now — I&rsquo;ll keep using the emailed link
              </Link>
            </p>
          ) : null}

          <p className="mx-auto m-0 mt-8 max-w-[46ch] text-center text-[12.5px] leading-relaxed text-[var(--color-ink-2)]">
            After five wrong attempts, password sign-in is switched off for this account and a
            sign-in link is emailed to you. Redeeming that link switches it back on. The lock has
            no timer on purpose — a timed lock is one an attacker waits out.
            {row?.passwordSetAt
              ? ` Last set ${row.passwordSetAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`
              : ''}
          </p>
        </div>
      </main>
    </div>
  );
}
