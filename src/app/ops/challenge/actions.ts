'use server';

import { revalidatePath } from 'next/cache';
import { setChallenge } from '@/modules/engagement/challenge';

/** Ops sets a week's "Spot the mistake" photo. `setChallenge` checks the role. */
export async function setChallengeAction(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const photo = form.get('photo');
  const r = await setChallenge({
    weekOf: String(form.get('weekOf') ?? ''),
    photo: photo instanceof File ? photo : null,
    x: Number(form.get('x')),
    y: Number(form.get('y')),
    radius: Number(form.get('radius')),
    answer: String(form.get('answer') ?? ''),
    explain: String(form.get('explain') ?? ''),
  });
  revalidatePath('/ops/challenge');
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
