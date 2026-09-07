import type { Metadata } from 'next';
import { studioRepository } from '@/modules/studio/repository';
import { MatchClient } from './MatchClient';

export const metadata: Metadata = {
  title: 'Your matches',
  description: 'Studios ranked for your home, with the reasoning shown.',
};

export default async function MatchPage() {
  const studios = await studioRepository.list({ activeOnly: true });
  return <MatchClient studios={studios} />;
}
