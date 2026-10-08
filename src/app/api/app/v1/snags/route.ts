import { fail, gate, json, signedIn, str } from '@/modules/app-api/http';
import { raiseSnag } from '@/modules/portal/project-store';

/**
 * POST /api/app/v1/snags — the customer raises a snag on their project.
 * Multipart: projectId, title, room?, note?, photos (up to four images).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Four phone photos, shrunk by the app; anything bigger is not from the app. */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES) return fail(413, 'Those photos are too large. Try fewer.');
  const form = await req.formData().catch(() => null);
  if (!form) return fail(400, 'That could not be read.');
  const photos = form.getAll('photos').filter((p): p is File => p instanceof File);
  const result = await raiseSnag(
    me.user.id,
    str(form.get('projectId'), 40),
    { title: form.get('title'), room: form.get('room'), note: form.get('note') },
    photos,
  );
  return result.ok ? json({ ok: true, id: result.id }) : fail(400, result.error);
}
