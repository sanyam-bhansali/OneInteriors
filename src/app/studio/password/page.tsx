import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/modules/auth/session';
import { canUsePassword } from '@/modules/auth/password';
import { prisma } from '@/lib/prisma';
import { StudioPasswordForm } from './StudioPasswordForm';
import '../office-ui.css';

export const metadata: Metadata = { title: 'Your password', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Choose or change your own password, inside the studio (owner, 27 Oct 2026:
 * password sign-in until WhatsApp codes are live; auth/studio-password.ts).
 * Someone on a one-time password the owner made lands here after signing in
 * and is kept here (the studio layout) until they choose their own: no old
 * password asked, they typed it a moment ago. Anyone else changes theirs with
 * the current one.
 */
export default async function StudioPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/studio/sign-in');
  if (!canUsePassword(user.role)) redirect('/studio');
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, passwordTemporary: true } });
  const temporary = row?.passwordTemporary === true;
  const hasOwn = row?.passwordHash != null && !temporary;

  return (
    <main className="content ox-page" style={{ maxWidth: 520 }}>
      <div className="phead">
        <div>
          <h1>{temporary ? 'Choose your own password' : hasOwn ? 'Change your password' : 'Choose a password'}</h1>
          <p className="muted">
            {temporary
              ? 'You signed in with a one-time password from your studio owner. Choose your own now; you sign in with it and your mobile number from now on.'
              : 'You sign in with your mobile number and this password.'}
          </p>
        </div>
      </div>
      <section className="card" style={{ padding: '20px 22px' }}>
        <StudioPasswordForm askCurrent={hasOwn} next="/studio" />
      </section>
      <p className="muted sm" style={{ margin: 0 }}>
        Five wrong tries locks it. Your studio owner can make you a new one-time password in Settings, Team.
      </p>
    </main>
  );
}
