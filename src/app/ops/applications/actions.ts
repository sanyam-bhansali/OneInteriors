'use server';

import { revalidatePath } from 'next/cache';
import {
  approveApplication,
  rejectApplication,
  setReviewing,
} from '@/modules/studio/application';

export interface DecisionState {
  status: 'idle' | 'done' | 'error';
  message?: string;
}

/**
 * One action for both decisions, because the UI is one form. The intent comes
 * from the submit button's `name`, so a form with JS disabled still works.
 */
export async function decideAction(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const id = String(formData.get('id') ?? '');
  const intent = String(formData.get('intent') ?? '');
  const note = String(formData.get('note') ?? '');

  if (!id) return { status: 'error', message: 'Missing application.' };

  const result =
    intent === 'approve'
      ? await approveApplication(id, note)
      : intent === 'reject'
        ? await rejectApplication(id, note)
        : intent === 'reviewing'
          ? await setReviewing(id)
          : ({ ok: false, error: 'Unknown action.' } as const);

  if (!result.ok) return { status: 'error', message: result.error };

  revalidatePath('/ops/applications');

  return {
    status: 'done',
    message:
      intent === 'approve'
        ? `Approved. Studio created in onboarding${
            'studioSlug' in result && result.studioSlug ? ` as /${result.studioSlug}` : ''
          }, and a sign-in link is on its way.`
        : intent === 'reject'
          ? 'Rejected. Tell them yourself as well — this does not email them.'
          : 'Marked as under review.',
  };
}
