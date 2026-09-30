import { waitlistStatus } from '@/modules/waitlist/ingest';
import { authorised, jsonBody, notConfigured } from '@/modules/waitlist/auth';

/** POST /api/waitlist/status {code} — a person's place, link and unlocks. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = authorised(req);
  if (auth === 'not-configured') return notConfigured();
  if (auth !== 'ok') return Response.json({ error: 'Not for you.' }, { status: 401 });
  const body = await jsonBody(req);
  const status = body ? await waitlistStatus(String(body.code ?? '')).catch(() => null) : null;
  return status ? Response.json({ ok: true, status }) : Response.json({ error: 'Unknown code' }, { status: 404 });
}
