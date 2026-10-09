import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { inviteView, joinFamily } from '@/modules/engagement/family';

export const metadata: Metadata = { title: 'Join your family’s home', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** A family invite link: sign in with the invited number, and you are in. */
export default async function JoinFamilyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!hasDatabase()) return <Shell title="Not on this test build." body="Family invites work on the live app." />;
  const user = await getCurrentUser();
  const view = await inviteView(token, user?.id ?? null);
  if (!view) return <Shell title="This invite has been withdrawn." body="Ask whoever sent it for a new one." />;

  if (user && view.joined) redirect('/app/home');
  if (user && view.matches) {
    const r = await joinFamily(token, user.id);
    if (r.ok) redirect('/app/home');
  }

  const who = view.ownerName?.split(' ')[0] ?? 'Your family';
  return (
    <Shell
      title={`${who} added you to their home.`}
      body={
        user
          ? `This invite is for a different number. Sign in with the number ${who} invited, to follow the work with ${view.studio}.`
          : `Follow the work with ${view.studio}: a site update every working day, and a vote on choices like finishes. Sign in with your mobile number.`
      }
      cta={{ href: `/sign-in?next=${encodeURIComponent(`/app/family/join/${token}`)}`, label: user ? 'Sign in with another number' : 'Sign in to join' }}
    />
  );
}

function Shell({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="oa-frame">
      <main className="oa-body" style={{ paddingTop: 72 }}>
        <h1 className="oa-title">{title}</h1>
        <p className="oa-sub">{body}</p>
        {cta ? (
          <Link href={cta.href} className="oa-cta">
            {cta.label}
          </Link>
        ) : null}
      </main>
    </div>
  );
}
