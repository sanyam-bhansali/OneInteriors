import type { Metadata } from 'next';
import { Studios } from './StudiosScreen';

export const metadata: Metadata = { title: 'All studios' };

/** Static, so it is prefetched; the data comes from the app's kept copy (`useAppData`). */
export default function AppStudiosPage() {
  return <Studios />;
}
