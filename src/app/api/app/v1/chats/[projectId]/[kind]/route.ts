import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { readThread, sendMessage, type ChatRefusal } from '@/modules/chat/store';

/**
 * One conversation (owner, 1 Nov 2026; modules/chat). `kind` is designer,
 * team or one_interiors.
 *
 * GET ?since=<cursor> — messages after the last one the screen has (asked
 * every few seconds while it is open); ?before=<time> — older ones. No
 * parameter: the newest sixty. Reading marks them read.
 *
 * POST — JSON { body, replyToId? }, or multipart with `file` (a photo, voice
 * note or PDF), `body`, `durationMs`, `replyToId`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS: Record<ChatRefusal, number> = { not_found: 404, not_yours: 403, problem: 400 };

type Params = { params: Promise<{ projectId: string; kind: string }> };

export async function GET(req: Request, { params }: Params) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { projectId, kind } = await params;
  const url = new URL(req.url);
  const r = await readThread(me.user, projectId, kind.toUpperCase(), { since: url.searchParams.get('since'), before: url.searchParams.get('before') });
  return r.ok ? json({ ok: true, ...r.value }) : fail(STATUS[r.reason], r.error);
}

/** A voice note or photo as sent from a phone: comfortably under the 4 MB request limit after the file store's own 3.8 MB check. */
export async function POST(req: Request, { params }: Params) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { projectId, kind } = await params;
  let input: { body: unknown; replyToId?: unknown; durationMs?: unknown; file?: File | null };
  if ((req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    if (!form) return fail(400, 'That message could not be read.');
    const file = form.get('file');
    input = { body: form.get('body') ?? '', replyToId: form.get('replyToId'), durationMs: form.get('durationMs'), file: file instanceof File ? file : null };
  } else {
    const b = (await readJson(req)) as Record<string, unknown> | null;
    if (!b) return fail(400, 'That message could not be read.');
    input = { body: b.body, replyToId: b.replyToId };
  }
  const r = await sendMessage(me.user, projectId, kind.toUpperCase(), input);
  return r.ok ? json({ ok: true, id: r.value.id }) : fail(STATUS[r.reason], r.error);
}
