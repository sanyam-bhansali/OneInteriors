import { waitlistPublicStats } from '@/modules/waitlist/ingest';
import { authorised, notConfigured } from '@/modules/waitlist/auth';

/** GET /api/waitlist/stats — the count (from a hundred) and the free calls left. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = authorised(req);
  if (auth === 'not-configured') return notConfigured();
  if (auth !== 'ok') return Response.json({ error: 'Not for you.' }, { status: 401 });
  const stats = await waitlistPublicStats().catch(() => null);
  return stats ? Response.json({ ok: true, stats }) : Response.json({ error: 'Unavailable' }, { status: 503 });
}
