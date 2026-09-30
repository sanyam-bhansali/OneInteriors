import { saveWaitlistExtras } from '@/modules/waitlist/ingest';
import { authorised, jsonBody, notConfigured } from '@/modules/waitlist/auth';

/** POST /api/waitlist/extras {code, possession, bhk, society, style} — "skip 20 places". */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = authorised(req);
  if (auth === 'not-configured') return notConfigured();
  if (auth !== 'ok') return Response.json({ error: 'Not for you.' }, { status: 401 });
  const body = await jsonBody(req);
  if (!body) return Response.json({ error: 'Expected JSON' }, { status: 400 });
  const status = await saveWaitlistExtras(String(body.code ?? ''), body).catch(() => null);
  return status ? Response.json({ ok: true, status }) : Response.json({ error: 'Unknown code' }, { status: 404 });
}
