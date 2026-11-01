import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { ChatList } from '@/components/chat/ChatList';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { requireRole } from '@/modules/auth/session';
import { OpsHeader } from '../ui';
import '@/app/studio/chats/chats.css';

export const metadata: Metadata = { title: 'Client chats', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The One Interiors conversation with each client (owner, 1 Nov 2026;
 * modules/chat): what clients wrote to us, answered here as One Interiors.
 * Studios never see these.
 */
export default async function OpsChats({ searchParams }: { searchParams: Promise<{ project?: string; thread?: string }> }) {
  await requireRole('OPS');
  const { project, thread } = await searchParams;
  const open = project && thread === 'ONE_INTERIORS' ? project : null;
  return (
    <>
      <OpsHeader />
      <main className="py-8">
        <Container size="wide">
          <div className={`sc-split${open ? ' has-open' : ''}`}>
            <section className="sc-list" aria-label="Conversations">
              <h1 className="sc-title">Client chats</h1>
              <ChatList target="ops" showHome selected={open ? `${open}:ONE_INTERIORS` : null} empty="No client has written to One Interiors yet." />
            </section>
            <section className="sc-room" aria-label="Conversation">
              {open ? <ChatRoom key={open} projectId={open} kind="ONE_INTERIORS" back="/ops/chats" /> : <p className="sc-pick">Pick a conversation.</p>}
            </section>
          </div>
        </Container>
      </main>
    </>
  );
}
