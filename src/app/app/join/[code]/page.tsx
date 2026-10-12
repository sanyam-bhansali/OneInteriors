import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { joinOwnProject, joinView } from '@/modules/project/own-project';
import { switchNumberAction } from './actions';

export const metadata: Metadata = { title: 'Follow your home’s project', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * A studio's own client's invite (docs/studio-workspace/OWN-CLIENTS.md): the
 * project is already on the account for the invited number, so signing in
 * with that number is all it takes. Signed in with it, this notes that they
 * joined and opens their home. The same pattern as a family invite.
 */
export default async function JoinProjectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!hasDatabase()) return <Shell title="Not on this test build." body="Invites work on the live app." />;
  const user = await getCurrentUser();
  const view = await joinView(code, user?.id ?? null);
  if (!view) return <Shell title="This link has been replaced." body="Ask your studio for the new one, or sign in with the number you gave them." />;

  if (user && view.matches) {
    await joinOwnProject(code, user.id);
    redirect('/app/home');
  }

  return (
    <Shell
      title={`${view.customerFirst}, ${view.studio} has started your home’s project.`}
      body={
        user
          ? `This link is for a different number. Sign in with ${view.phoneHint}, the number you gave ${view.studio}, to follow the work.`
          : `Follow it here or in the One Interiors app: a site update every working day, the plan, payments and your documents. Sign in with ${view.phoneHint}.`
      }
      cta={user ? undefined : { href: `/sign-in?next=${encodeURIComponent(`/app/join/${code}`)}`, label: 'Sign in to follow it' }}
      switchCode={user ? code : undefined}
    />
  );
}

function Shell({ title, body, cta, switchCode }: { title: string; body: string; cta?: { href: string; label: string }; switchCode?: string }) {
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
        {switchCode ? (
          // Signed in with another number: sign out first, or sign-in would send them straight back here.
          <form action={switchNumberAction.bind(null, switchCode)}>
            <button type="submit" className="oa-cta">
              Sign in with another number
            </button>
          </form>
        ) : null}
      </main>
    </div>
  );
}
