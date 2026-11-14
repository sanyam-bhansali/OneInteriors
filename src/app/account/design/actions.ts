'use server';

import { revalidatePath } from 'next/cache';
import { answerMockup, drawRound, type AnswerResult, type DrawRoundResult } from '@/modules/design-dna/store';

/** "Show me room ideas" for one room: three new pictures from the DNA as it stands. */
export async function drawRoundAction(room: string): Promise<DrawRoundResult> {
  const result = await drawRound(room);
  if (result.ok) revalidatePath('/account/design');
  return result;
}

/** Yes or no on one picture, with an optional one-tap reason for a no. */
export async function answerMockupAction(id: string, verdict: string, reason: string | null): Promise<AnswerResult> {
  const result = await answerMockup(id, verdict, reason);
  if (result.ok) revalidatePath('/account/design');
  return result;
}
