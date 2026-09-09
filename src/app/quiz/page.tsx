import type { Metadata } from 'next';
import { studioRepository } from '@/modules/studio/repository';
import { QuizClient } from './QuizClient';

export const metadata: Metadata = {
  title: 'Tell us about your home',
  description: 'Nine questions, about three minutes. No signup until you have seen your matches.',
};

/** Per request: the roster must not be frozen into a build. See /match. */
export const dynamic = 'force-dynamic';

/**
 * Server shell. The quiz itself is interactive, but the studio list it scores
 * against comes from the repository — so the client never reaches for data
 * directly, and Postgres is a swap behind this line rather than a rewrite.
 */
export default async function QuizPage() {
  const studios = await studioRepository.list({ activeOnly: true });
  return <QuizClient studios={studios} />;
}
