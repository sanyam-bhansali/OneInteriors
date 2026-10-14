import { opening, refuse, reply } from '@/modules/project/site-http';
import { hearVoiceNote } from '@/modules/project/site-log';

/**
 * POST /api/studio/site/speech — { projectId, voicePath?, lang, room? }
 * → what was heard, the sentence the customer will read (in their
 * language) and the checklist items the note seems to mention. Shown to the
 * supervisor before posting; nothing is saved here. `speech_off` when no
 * speech provider is switched on (modules/speech).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const open = await opening(req);
  if (!open.ok) return open.response;
  const r = await hearVoiceNote(open.body);
  if (!r.ok) return r.error === 'speech_off' ? reply({ ok: false, error: 'speech_off' }) : refuse(r.error);
  return reply({ ok: true, heard: r.heard });
}
