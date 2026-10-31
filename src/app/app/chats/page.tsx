import type { Metadata } from 'next';
import { Frame, Tabs } from '@/components/app/ui';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { projectContacts } from '@/modules/portal/project-contacts';

export const metadata: Metadata = { title: 'Chats', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Chats (the owner's v1 screens). Chat inside the app is being built (owner,
 * 1 Nov 2026: our own chat, never WhatsApp from us); clients join first, so
 * until it is ready this says so and lets them call their designer.
 */
export default async function AppChats() {
  const user = hasDatabase() ? await getCurrentUser().catch(() => null) : null;
  const view = user ? await projectContacts(user.id).catch(() => null) : null;
  return (
    <Frame>
      <header className="oa-page-head">
        <span className="oa-meta">{view ? view.studio : 'Your home team'}</span>
        <h1>Chats</h1>
      </header>
      <main className="oa-body">
        <section className="oa-card">
          <p className="oa-row-title" style={{ margin: 0 }}>
            Chat with your home team is coming here soon.
          </p>
          <p className="oa-note" style={{ margin: '6px 0 0' }}>
            Your designer, your site head and everyone at home, in one place, with photos and voice notes. Until then, call your designer, or keep using your
            studio&rsquo;s group.
          </p>
        </section>
        {view && view.contacts.length ? (
          <div className="oa-list">
            {view.contacts.map((c) => (
              <div key={`${c.role}-${c.name}`} className="oa-row">
                <span>
                  <span className="oa-row-title">{c.name}</span>
                  <span className="oa-row-sub">{c.role}</span>
                </span>
                {c.phone ? (
                  <a href={`tel:${c.phone}`} className="oa-pill" aria-label={`Call ${c.name}`}>
                    Call
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="oa-note">Your designer&rsquo;s name shows here once your studio adds them to your project.</p>
        )}
      </main>
      <Tabs />
    </Frame>
  );
}
