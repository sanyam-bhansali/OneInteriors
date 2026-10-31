import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { requestFacts } from '@/modules/project/signoff-rules';
import { signQuote } from '@/modules/project/signoffs';

/**
 * POST /api/app/v1/signoffs/:id — { agreed: true, name, hash }. The owner of
 * the brief signs a quotation the studio asked them to sign
 * (project/signoffs.ts): the typed full name is the signature; who, when,
 * the IP and user agent, and the hash of exactly what was shown are kept.
 * The page that shows the quotation is /app/signoff/:id (the phone app opens
 * it inside the app).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const body = (await readJson(req)) as { agreed?: unknown; name?: unknown; hash?: unknown } | null;
  const facts = requestFacts({ forwardedFor: req.headers.get('x-forwarded-for'), realIp: req.headers.get('x-real-ip'), userAgent: req.headers.get('user-agent') });
  const result = await signQuote(me.user.id, id.slice(0, 64), { agreed: body?.agreed, name: body?.name, hash: body?.hash }, facts);
  return result.ok ? json({ ok: true, message: result.message ?? null, signedLine: result.signedLine ?? null }) : fail(400, result.error);
}
