import { fail, gate, json, signedIn, str } from '@/modules/app-api/http';
import { bookServiceVisit } from '@/modules/aftercare/store';

/**
 * POST /api/app/v1/aftercare/service — book a paid service visit (owner,
 * 20 Nov 2026). Multipart: projectId, category, description, day
 * (YYYY-MM-DD), start ("10:00" | "12:00" | "14:00" | "16:00"), photos (0–4).
 *
 * 402 with `pendingPaise` when the project is not 100% paid. Otherwise the
 * slot is held for 20 minutes and `payUrl` is the Razorpay page for the
 * visiting charge; the visit is booked only once it is paid.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES) return fail(413, 'Those photos are too large. Try fewer.');
  const form = await req.formData().catch(() => null);
  if (!form) return fail(400, 'That could not be read.');
  const photos = form.getAll('photos').filter((p): p is File => p instanceof File);
  const r = await bookServiceVisit(
    me.user.id,
    str(form.get('projectId'), 64),
    { category: form.get('category'), description: form.get('description'), day: form.get('day'), start: form.get('start') },
    photos,
  );
  if (r.ok) return json(r);
  if ('pendingPaise' in r) return json({ ok: false, error: r.error, gate: 'payments', pendingPaise: r.pendingPaise ?? null }, 402);
  return fail(400, r.error);
}
