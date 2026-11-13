import type { Metadata } from 'next';
import Link from 'next/link';
import { myPagesScreen } from '@/modules/studio-intake/meta-account';
import { MetaPagePicker } from './MetaPagePicker';

export const metadata: Metadata = { title: 'Connect a Facebook Page', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Settings → Lead sources → Connect a Facebook Page (owner, 12 Nov 2026):
 * where Connect Facebook lands. The Pages the login can manage, each with
 * Connect; then back to Lead sources to choose campaigns.
 */
export default async function MetaPagesPage() {
  const screen = await myPagesScreen();
  return (
    <div className="flex max-w-[44rem] flex-col gap-4">
      <Link href="/studio/settings/sources" className="text-[13px] underline">
        ← Lead sources
      </Link>
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="m-0 text-[16px] font-semibold">Connect a Facebook Page</h2>
        {!screen || !screen.canManage ? (
          <p className="m-0 text-[13.5px] muted">The owner or a project manager connects Facebook.</p>
        ) : screen.blocker ? (
          <p className="m-0 text-[13.5px] muted">{screen.blocker}</p>
        ) : !screen.login ? (
          <p className="m-0 text-[13.5px]">
            Log in with Facebook first (a login lasts about 60 days).{' '}
            <a href="/api/studio/meta/connect" className="underline">
              Connect Facebook
            </a>
            .
          </p>
        ) : (
          <>
            <p className="m-0 text-[13.5px] muted">
              Logged in as {screen.login.name ?? 'your Facebook account'}
              {screen.login.untilLabel ? ` (until ${screen.login.untilLabel})` : ''}. Pick the Page your lead ads run from.
            </p>
            {screen.error ? <p className="m-0 text-[13.5px] text-[var(--s-bad)]">{screen.error}</p> : null}
            <MetaPagePicker pages={screen.pages} />
          </>
        )}
      </section>
    </div>
  );
}
