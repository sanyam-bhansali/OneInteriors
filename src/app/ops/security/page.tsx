import { getCurrentUser } from '@/modules/auth/session';
import { prisma } from '@/lib/prisma';
import { SecurityForm } from './SecurityForm';

export const dynamic = 'force-dynamic';

/**
 * Where an ops password is set — and the only place.
 *
 * There is deliberately no seed script and no CLI flag for this. A password
 * that arrives through a script has been typed into a terminal, a chat, or a
 * note to yourself, and is compromised before it is ever used. The person who
 * will type it is the only one who should ever have seen it.
 */
export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, passwordSetAt: true, lockedOutAt: true },
  });

  return (
    <main className="mx-auto max-w-[760px] px-6 py-12">
      <p className="label m-0 mb-2">Your account</p>
      <h1 className="m-0 mb-3 font-[family-name:var(--font-display)] text-[30px] leading-[1.15] tracking-[-.015em] text-[var(--color-ink)]">
        Password
      </h1>
      <p className="m-0 mb-8 max-w-[52ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
        A password is a second way into the console, for when email is not
        working — which is exactly when you most need to be in here. The
        emailed sign-in link keeps working either way.
      </p>

      <SecurityForm hasPassword={row?.passwordHash != null} />

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
