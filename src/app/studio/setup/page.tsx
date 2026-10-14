import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { mySetup } from '@/modules/studio/setup-quiz-store';
import { STUDIO_HOME } from '@/modules/studio/surfaces';
import { SetupQuiz } from './SetupQuiz';
import './setup.css';

export const metadata: Metadata = { title: 'Set up your studio', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * "Set up your studio" (owner, 14 Oct 2026): the owner's quiz, shown on their
 * first sign-in after the studio's software opens and retaken from Settings.
 * The owner's alone (the door, `mayOpen`, and `mySetup` both say so).
 */
export default async function SetupPage() {
  const view = await mySetup();
  if (!view) redirect(STUDIO_HOME);
  return <SetupQuiz initial={view.record?.answers ?? null} teamOpen={view.teamOpen} full={view.full} again={view.record !== null} />;
}
