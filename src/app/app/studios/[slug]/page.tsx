import type { Metadata } from 'next';
import { Profile } from './ProfileScreen';

export const metadata: Metadata = { title: 'Studio' };

/** The data comes from the app's kept copy (`useAppData`), so the profile opens instantly from the matches. */
export default function AppStudioPage() {
  return <Profile />;
}
