import { fail, gate, json, signedIn, str } from '@/modules/app-api/http';
import { raiseWarrantyClaim } from '@/modules/aftercare/store';

/**
 * POST /api/app/v1/aftercare/warranty — a warranty claim (owner, 20 Nov 2026).
 * Multipart: projectId, area (a coverage rule key), description, photos (1–4).
 *
 * 402 with `pendingPaise` when the project is not 100% paid: "Please clear
 * your payments first". Otherwise 200 with `covered`: true (a warranty snag
 * was raised, `snagId`) or false (the automatic "not covered" reply and the
 * service category to book instead; nothing raised).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Four phone photos, shrunk by the app. */
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
  const r = await raiseWarrantyClaim(me.user.id, str(form.get('projectId'), 64), { description: form.get('description'), area: form.get('area') }, photos);
  if (r.ok) return json(r);
  if ('pendingPaise' in r) return json({ ok: false, error: r.error, gate: 'payments', pendingPaise: r.pendingPaise ?? null }, 402);
  return fail(400, r.error);
}
