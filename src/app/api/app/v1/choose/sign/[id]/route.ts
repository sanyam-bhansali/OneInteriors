import { clientIp, fail, gate, json, readJson, signedIn, str } from '@/modules/app-api/http';
import { signWithCode } from '@/modules/portal/sign';
import { parsePlan } from '@/modules/portal/plans';

/**
 * POST /api/app/v1/choose/sign/:id — `{ code, plan: 'basic' | 'assured', agreed? }`
 * → `{ ok, projectId, plan: 'basic', assuredRequested }`.
 *
 * Signs the final quote with the code from `.../code`, through the same
 * module as the website's Sign screen. The app shows the agreement and its
 * tick before the code is sent, so `agreed` defaults to true; an app that
 * sends `agreed: false` is refused. Assured registers interest only: the
 * project starts on Basic and ops is told. 404 when the quote is not theirs.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const body = (await readJson(req)) as { code?: unknown; plan?: unknown; agreed?: unknown } | null;
  const plan = parsePlan(body?.plan);
  if (!plan) return fail(400, 'Choose Basic or Assured.');
  const code = str(body?.code, 12);
  if (!code) return fail(400, 'Enter the 6-digit code.');
  const { id } = await params;
  const r = await signWithCode(
    me.user,
    { quoteId: id.slice(0, 64), code, agreed: body?.agreed !== false, plan },
    // A bearer session, so verifying the code never sets a cookie on the app.
    { userAgent: req.headers.get('user-agent'), ip: clientIp(req), bearer: true },
  );
  if (!r.ok) return fail(r.notFound ? 404 : 400, r.error);
  return json(r);
}
