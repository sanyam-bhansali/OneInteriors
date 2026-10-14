'use server';

import { revalidatePath } from 'next/cache';
import { hearSnagFix, markSnagFixed } from '@/modules/project/snag-flow';

/**
 * Site mode's *Fix a snag* (studio workspace Phase 4). Small JSON only: the
 * photo and the recording were uploaded straight to storage through
 * `/api/studio/site/upload`, so only their paths come here. Every check —
 * `snag.fix` on this project, that the paths are this project's, that the
 * snag is waiting for a fix — is in project/snag-flow.ts.
 */

export type Heard = { transcript: string; transcriptLang: string; customerText: string; customerLang: string; provider: string } | null;

export async function hearFixAction(snagId: string, voicePath: string, lang: string): Promise<{ ok: true; heard: Heard } | { ok: false; error: string }> {
  return hearSnagFix(String(snagId).slice(0, 64), String(voicePath).slice(0, 200), String(lang).slice(0, 4));
}

export async function markFixedAction(
  snagId: string,
  input: {
    photoPaths: string[];
    fromGallery: boolean;
    voice: { path: string; transcript: string; lang: string | null; customerText: string } | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(snagId).slice(0, 64);
  const r = await markSnagFixed(id, {
    photoPaths: Array.isArray(input?.photoPaths) ? input.photoPaths.map((p) => String(p).slice(0, 200)).slice(0, 4) : [],
    fromGallery: Boolean(input?.fromGallery),
    voice: input?.voice
      ? {
          path: String(input.voice.path ?? '').slice(0, 200) || null,
          transcript: String(input.voice.transcript ?? ''),
          lang: input.voice.lang ? String(input.voice.lang) : null,
          customerText: String(input.voice.customerText ?? ''),
        }
      : null,
  });
  if (!r.ok) return r;
  revalidatePath('/studio/site/snag');
  revalidatePath(`/studio/site/snag/${id}`);
  return { ok: true };
}
