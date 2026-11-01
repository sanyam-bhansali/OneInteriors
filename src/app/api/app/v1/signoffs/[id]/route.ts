import { fail, gate, json, readJson, signedIn } from '@/modules/app-api/http';
import { requestFacts } from '@/modules/project/signoff-rules';
import { signoffDocument, signQuote } from '@/modules/project/signoffs';

/**
 * POST /api/app/v1/signoffs/:id — { agreed: true, name, hash }. The owner of
 * the brief signs a quotation the studio asked them to sign
 * (project/signoffs.ts): the typed full name is the signature; who, when,
 * the IP and user agent, and the hash of exactly what was shown are kept.
 * The page that shows the quotation is /app/signoff/:id.
 *
 * GET /api/app/v1/signoffs/:id — the same revision for the phone app's own
 * sign-off screen (1 Nov 2026): every line by room, the totals, the payment
 * stages and the terms, with the `hash` of exactly this content, which is
 * what the signature binds (signoff-rules.ts hashes the data, not a layout).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate('project');
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const d = await signoffDocument(id.slice(0, 64));
  if (!d) return fail(404, 'That sign-off is not on your project.');
  const t = d.doc.totals;
  return json({
    ok: true,
    id: d.id,
    kind: d.kind,
    kindLabel: d.kindLabel,
    quoteNumber: d.quoteNumber,
    revision: d.revision,
    state: d.state,
    canSign: d.canSign,
    viewer: d.viewer,
    hash: d.hash,
    changedSince: d.changedSince,
    signed: d.signed ? { name: d.signed.name, on: d.signed.on, line: d.signed.line } : null,
    agreeText: d.agreeText,
    studio: d.doc.studio?.tradeName ?? d.doc.studio?.name ?? null,
    lines: d.doc.lines.map((l) => ({ room: l.room, product: l.product, details: l.details, note: l.note ?? null, amountPaise: l.amountPaise })),
    totals: {
      workPaise: t.workPaise,
      feePaise: t.feePaise,
      discountPaise: t.discountPaise + t.onSpotPaise,
      gstPaise: t.gstPaise,
      totalPaise: t.totalPaise,
    },
    stages: (d.doc.schedule ?? t.stages).map((st) => ({ label: st.label, amountPaise: st.amountPaise })),
    terms: d.doc.terms,
  });
}

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
