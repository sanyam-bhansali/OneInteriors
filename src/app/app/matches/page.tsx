import type { Metadata } from 'next';
import { appData } from '../data';
import { MatchesScreen } from './MatchesScreen';

export const metadata: Metadata = { title: 'Your matches' };
export const dynamic = 'force-dynamic';

export default async function AppMatchesPage() {
  return <MatchesScreen data={await appData()} />;
}
