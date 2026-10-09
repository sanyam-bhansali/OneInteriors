import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasDatabase } from '@/lib/env';
import { getCurrentUser } from '@/modules/auth/session';
import { finalQuoteView } from '@/modules/portal/choose';
import { firstBeforeGst } from '../../first';
import { SignScreen } from './SignScreen';

export const metadata: Metadata = { title: 'Sign', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function SignPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) notFound();
  const { id } = await params;
  const [view, user] = await Promise.all([finalQuoteView(id, firstBeforeGst), getCurrentUser()]);
  if (!view || !user) notFound();
  return <SignScreen q={view} name={(user.name ?? '').split(' ')[0] ?? ''} phone={user.phone ?? ''} />;
}
