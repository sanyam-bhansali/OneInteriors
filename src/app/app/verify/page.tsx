import type { Metadata } from 'next';
import { Verify } from './VerifyScreen';

export const metadata: Metadata = { title: 'Your quotes are ready' };

/** Static, so it is prefetched; the data comes from the app's kept copy (`useAppData`). */
export default function AppVerifyPage() {
  return <Verify />;
}
