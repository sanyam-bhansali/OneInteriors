import type { Metadata } from 'next';
import { Matches } from './MatchesScreen';

export const metadata: Metadata = { title: 'Your matches' };

/** Static, so it is prefetched; the data comes from the app's kept copy (`useAppData`). */
export default function AppMatchesPage() {
  return <Matches />;
}
