import type { Metadata } from 'next';
import { ARCHITECT } from '@/modules/consultation/architect';
import { GeioScreen } from './GeioScreen';

export const metadata: Metadata = { title: 'GEIO', robots: { index: false, follow: false } };

export default async function AppGeioPage({ searchParams }: { searchParams: Promise<{ from?: string; ask?: string }> }) {
  const { from, ask } = await searchParams;
  const back = typeof from === 'string' && /^[a-z0-9]{1,12}$/.test(from) ? `/app/${from}` : '/app/home';
  return (
    <GeioScreen back={back} expert={ARCHITECT.name.replace(/^Ar\.\s*/, '').split(' ')[0]!} startWithExpert={ask === 'expert'} />
  );
}
