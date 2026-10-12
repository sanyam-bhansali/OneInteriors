import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLang } from '@/modules/i18n/server';
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { memberFor } from '@/modules/studio/access';
import { homeFor } from '@/modules/studio/surfaces';
import { hasDatabase } from '@/lib/env';
import { THEME_SCRIPT } from '../studio/ui/theme-script';
import { Splash } from '../studio/home/HomeBits';
import { StudioSignInForm } from './StudioSignInForm';
import '../studio/studio-ui.css';
import './sign-in.css';

export const metadata: Metadata = { title: 'Studio sign in', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * /studio/sign-in — the studio's one sign-in (the owner's UI handoff:
 * StudioSignInWeb, StudioSignIn). Served from here, outside app/studio,
 * because the studio layout sends signed-out people away; `lib/host.ts`
 * rewrites the address to this page. It draws the studio look itself: the
 * `.oi-studio` scope and the theme set before the first paint.
 *
 * Already signed in as an active team member: straight to their screen.
 */
export default async function StudioSignInPage() {
  const lang = await getLang();
  const user = await getCurrentUser();
  /* Not while the page's own sign-in action is answering: signing in sets
     the cookie, Next re-renders this page for the action, and a redirect
     here would skip the role check and "Welcome back". The page sends them
     home itself once they have seen it. */
  const fromAction = (await headers()).has('next-action');
  if (user && !fromAction && hasRole(user, 'STUDIO') && hasDatabase()) {
    const member = await memberFor(user.id).catch(() => null);
    if (member?.status === 'ACTIVE') redirect(homeFor(member.role));
  }
  return (
    <div className="oi-studio studio-app">
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <Splash greeting="Studio" sub="The software your practice runs on" />
      <StudioSignInForm initialLang={lang} />
    </div>
  );
}
