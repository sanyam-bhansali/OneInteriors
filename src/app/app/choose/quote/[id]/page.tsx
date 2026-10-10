import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasDatabase } from '@/lib/env';
import { finalQuoteView } from '@/modules/portal/choose';
import { firstBeforeGst } from '../../first';
import { FinalQuoteScreen } from './FinalQuoteScreen';

export const metadata: Metadata = { title: 'Your final quote', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function FinalQuotePage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) notFound();
  const { id } = await params;
  const view = await finalQuoteView(id, firstBeforeGst);
  if (!view) notFound();
  return <FinalQuoteScreen q={view} />;
}
