import type { Metadata } from 'next';
import { loadBrief } from '@/modules/brief/repository';
import { EMPTY_BRIEF } from '@/modules/brief/types';
import { TierClient } from './TierClient';

export const metadata: Metadata = {
  title: 'What your home costs',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function TierPage() {
  // No redirect if the brief is missing server-side: the client holds its own
  // copy in sessionStorage and reconciles. Bouncing someone back to the quiz
  // they just finished, because a background write had not landed yet, is the
  // worst possible moment to lose them.
  const { brief, found } = await loadBrief();
  return <TierClient initial={found ? brief : EMPTY_BRIEF} />;
}
