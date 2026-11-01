import type { Metadata } from 'next';
import { Frame, Tabs } from '@/components/app/ui';
import { ChatList } from '@/components/chat/ChatList';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { projectContacts } from '@/modules/portal/project-contacts';

export const metadata: Metadata = { title: 'Chats', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Chats (the owner's v1 screens; owner, 1 Nov 2026: our own chat, never
 * WhatsApp from us). The client's conversations: their designer, the home
 * team, and One Interiors. A call button stays for the designer.
 */
export default async function AppChats() {
  const user = hasDatabase() ? await getCurrentUser().catch(() => null) : null;
  const view = user ? await projectContacts(user.id).catch(() => null) : null;
  const designer = view?.contacts.find((c) => c.role === 'Designer' && c.phone) ?? null;
  return (
    <Frame>
      <header className="oa-page-head">
        <span className="oa-meta">{view ? view.studio : 'Your home team'}</span>
        <h1>Chats</h1>
      </header>
      <main className="oa-body">
        <ChatList
          target="app"
          empty="Your conversations show here once your studio has started your project."
        />
        <p className="oa-note">Your phone number stays private: your studio sees your name, not your number.</p>
        {designer ? (
          <a href={`tel:${designer.phone}`} className="oa-cta outline" style={{ textAlign: 'center' }}>
            Call {designer.name.split(' ')[0]}, your designer
          </a>
        ) : null}
      </main>
      <Tabs />
    </Frame>
  );
}
