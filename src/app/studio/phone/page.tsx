import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentMember } from '@/modules/studio/access';
import { mayOpen, SITE_HOME } from '@/modules/studio/surfaces';
import { signOutAction } from '@/app/sign-in/actions';

export const metadata: Metadata = { title: 'Open it on your laptop', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Where a phone lands on any studio screen but site mode (owner, 1 Nov 2026;
 * studio/phone-rules.ts, the middleware sends it here). A supervisor's whole
 * studio is site mode, so they go straight there; anyone else who may open
 * site mode gets it as a button; the rest only the reason and sign out.
 */
export default async function PhonePage() {
  const member = await currentMember();
  const site = member ? mayOpen(member, SITE_HOME) : false;
  if (member?.role === 'SUPERVISOR' && site) redirect(SITE_HOME);
  return (
    <main className="content" style={{ maxWidth: 520, margin: '8vh auto', padding: '0 16px' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Open the studio on your laptop</h1>
        <p className="muted" style={{ margin: 0 }}>
          On a phone the studio opens site mode only: today&rsquo;s site updates, snags and meetings. Projects, design, quotations, documents and chats are on the laptop.
        </p>
        {site ? (
          <Link href={SITE_HOME} className="btn" style={{ alignSelf: 'flex-start' }}>
            Open site mode
          </Link>
        ) : null}
        <form action={signOutAction}>
          <button type="submit" className="btn ghost sm">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
