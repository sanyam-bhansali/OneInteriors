import type { Metadata } from 'next';
import { publicStudios } from '@/modules/studio/public';
import { cachedRoster } from '@/modules/studio/roster-cache';
import { appleOAuth, facebookOAuth, googleOAuth, showUnverifiedStudios } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { QuizClient } from './QuizClient';

export const metadata: Metadata = {
  title: 'Tell us about your home',
  description: 'About four minutes about your home, and your matches at the end.',
};

/** Per request: the roster must not be frozen into a build. See /match. */
export const dynamic = 'force-dynamic';

/**
 * Server shell. The quiz itself is interactive, but the studio list it scores
 * against comes from the repository — so the client never reaches for data
 * directly, and Postgres is a swap behind this line rather than a rewrite.
 */
export default async function QuizPage() {
  const [studios, user] = await Promise.all([cachedRoster(), getCurrentUser()]);
  // The live "N studios match so far" counter ranks in the browser, so the gate
  // is read here and handed down. See MatchClient for the full reasoning.
  return (
    <QuizClient
      studios={publicStudios(studios)}
      allowUnverified={showUnverifiedStudios()}
      // Who they are, if signed in — the contact screen fills in from it.
      account={user ? { name: user.name, email: user.email } : null}
      // Offered only when it is set up end to end; see googleOAuth().
      socialSignIn={{
        google: googleOAuth() !== null,
        apple: appleOAuth() !== null,
        facebook: facebookOAuth() !== null,
      }}
    />
  );
}
