import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { chatList } from '@/modules/chat/store';

export const metadata: Metadata = { title: 'Chat', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const KINDS = ['designer', 'team', 'one_interiors'];

/**
 * One conversation, full screen. `?project=` picks the project; without it
 * (a notice's link) the client's newest project with this conversation.
 */
export default async function AppChat({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ project?: string }> }) {
  const { kind } = await params;
  const { project } = await searchParams;
  if (!KINDS.includes(kind)) notFound();
  const user = hasDatabase() ? await getCurrentUser().catch(() => null) : null;
  if (!user) notFound();
  const projectId = project ?? (await chatList(user)).find((c) => c.kind.toLowerCase() === kind)?.projectId ?? null;
  if (!projectId) notFound();
  return (
    <div className="oa-frame" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <ChatRoom projectId={projectId} kind={kind} back="/app/chats" />
    </div>
  );
}
