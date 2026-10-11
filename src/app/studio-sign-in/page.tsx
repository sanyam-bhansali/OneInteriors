import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLang } from '@/modules/i18n/server';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { memberFor } from '@/modules/studio/access';
import { homeFor } from '@/modules/studio/surfaces';
import { hasDatabase } from '@/lib/env';
import { StudioSignInForm } from './StudioSignInForm';

export const metadata: Metadata = { title: 'Studio sign in', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * /studio/sign-in — studio staff sign in with their mobile number (design:
 * docs/studio-workspace/designs/studio/StudioSignIn.dc.html, in the studio's
 * own deep-green palette). Served from here, outside app/studio, because the
 * studio layout sends signed-out people away; `lib/host.ts` rewrites the
 * address to this page.
 *
 * Already signed in as an active team member: straight to their screen.
 */
export default async function StudioSignInPage() {
  const lang = await getLang();
  const user = await getCurrentUser();
  if (user && hasRole(user, 'STUDIO') && hasDatabase()) {
    const member = await memberFor(user.id).catch(() => null);
    if (member?.status === 'ACTIVE') redirect(homeFor(member.role));
  }
  return (
    <div className="studio-app min-h-dvh bg-[var(--s-ground)] text-[var(--s-ink)]">
      <StudioSignInForm initialLang={lang} />
    </div>
  );
}
