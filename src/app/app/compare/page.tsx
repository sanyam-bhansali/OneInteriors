import type { Metadata } from 'next';
import { Compare } from './CompareScreen';

export const metadata: Metadata = { title: 'Side by side' };

/** Static, so it is prefetched; the data comes from the app's kept copy (`useAppData`). */
export default function AppComparePage() {
  return <Compare />;
}
