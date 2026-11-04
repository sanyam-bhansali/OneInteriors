import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/modules/auth/session';
import { DeleteForm } from './DeleteForm';

export const metadata: Metadata = { title: 'Delete your account · One Interiors', robots: { index: true, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Deleting an account from the web (owner, 3 Nov 2026: store release). Google
 * Play asks for a web address where a person can ask for their account to be
 * deleted, not only a button inside the app. Signed in, it is the same erase
 * as the app's Me → Delete my account (DELETE /api/app/v1/me,
 * modules/auth/erase.ts); signed out, it says how to sign in or write to us.
 */
export default async function DeleteAccount() {
  const user = await getCurrentUser();
  return (
    <div className="oa-frame">
      <main className="oa-body" style={{ paddingTop: 56 }}>
        <h1 className="oa-title">Delete your One Interiors account</h1>
        <p className="oa-sub">You can delete your account at any time, from the app (Me → Delete my account) or here.</p>

        <h2 className="oa-label" style={{ marginTop: 18 }}>
          What is deleted
        </h2>
        <ul className="oa-note">
          <li>Your name, mobile number, email and password.</li>
          <li>Every sign-in, on every phone, and the phone notifications.</li>
          <li>Your notifications, and your contact details on your home brief.</li>
        </ul>
        <h2 className="oa-label">What your studio keeps</h2>
        <p className="oa-note">
          The record of the work on your home — its plan, decisions, snags, documents and payments — stays with your studio, because they need it to finish and guarantee the job. It
          no longer says whose number it was. Deleting cannot be undone.
        </p>

        {user ? (
          <DeleteForm />
        ) : (
          <>
            <p className="oa-note">
              <Link href="/app/sign-in?next=/app/delete-account">Sign in</Link> with your mobile number to delete your account here. Cannot sign in? Write to{' '}
              <a href="mailto:hello@oneinteriors.in?subject=Delete%20my%20account">hello@oneinteriors.in</a> from your email, with the mobile number on your account. We answer within
              30 days.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
