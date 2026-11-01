import type { Metadata } from 'next';
import { ChatList } from '@/components/chat/ChatList';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { currentMember } from '@/modules/studio/access';
import '../office-ui.css';
import './chats.css';

export const metadata: Metadata = { title: 'Chats', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Chats with clients (owner, 1 Nov 2026; modules/chat): the conversations a
 * client has started or the studio answered, newest first, and the one open
 * beside them. The designer, owner, design head and PMs see a client's
 * designer conversation; everyone on the project sees the home team. A
 * conversation starts from the project page (Chat with the client).
 */
export default async function StudioChats({ searchParams }: { searchParams: Promise<{ project?: string; thread?: string }> }) {
  const { project, thread } = await searchParams;
  const member = await currentMember();
  if (!member) {
    return (
      <main className="content ox-page">
        <p className="ox-note">Sign in to your studio to see your chats.</p>
      </main>
    );
  }
  const open = project && thread && ['DESIGNER', 'TEAM'].includes(thread) ? { project, thread } : null;
  return (
    <main className="content ox-page sc-page">
      <div className={`sc-split${open ? ' has-open' : ''}`}>
        <section className="sc-list" aria-label="Conversations">
          <h1 className="sc-title">Chats</h1>
          <ChatList target="studio" showHome selected={open ? `${open.project}:${open.thread}` : null} empty="No conversations yet. They start when a client writes, or from a project page: Chat with the client." />
        </section>
        <section className="sc-room" aria-label="Conversation">
          {open ? (
            <ChatRoom key={`${open.project}:${open.thread}`} projectId={open.project} kind={open.thread} back="/studio/chats" asStudio />
          ) : (
            <p className="ox-note sc-pick">Pick a conversation.</p>
          )}
        </section>
      </div>
    </main>
  );
}
