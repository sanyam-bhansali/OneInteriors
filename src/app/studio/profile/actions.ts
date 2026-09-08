'use server';

import { revalidatePath } from 'next/cache';
import { generateDraft, approveDraft } from '@/modules/studio/profile-draft-store';
import type { VerificationIssue } from '@/modules/studio/portfolio-draft';

export interface DraftState {
  status: 'idle' | 'done' | 'error';
  message?: string;
  issues?: VerificationIssue[];
}

export async function generateDraftAction(
  _prev: DraftState,
  _formData: FormData,
): Promise<DraftState> {
  const result = await generateDraft();
  if (!result.ok) return { status: 'error', message: result.error };

  revalidatePath('/studio/profile');
  return {
    status: 'done',
    issues: result.issues,
    message:
      result.issues.length === 0
        ? 'Drafted. Read it properly before you approve it — it is your name on it.'
        : 'Drafted, but the checks found problems. Fix them before approving.',
  };
}

export async function approveDraftAction(
  _prev: DraftState,
  formData: FormData,
): Promise<DraftState> {
  const stories: { title: string; story: string }[] = [];
  for (let i = 0; formData.has(`story-title-${i}`); i += 1) {
    stories.push({
      title: String(formData.get(`story-title-${i}`) ?? ''),
      story: String(formData.get(`story-${i}`) ?? ''),
    });
  }

  const result = await approveDraft({
    headline: String(formData.get('headline') ?? ''),
    introduction: String(formData.get('introduction') ?? ''),
    notFor: String(formData.get('notFor') ?? ''),
    projectStories: stories,
  });

  if (!result.ok) return { status: 'error', message: result.error };

  revalidatePath('/studio/profile');
  revalidatePath('/studio');
  return { status: 'done', message: 'Approved. This is your profile copy now.' };
}
