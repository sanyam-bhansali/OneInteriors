import { fail, gate, json, signedIn } from '@/modules/app-api/http';
import { finalQuoteView } from '@/modules/portal/choose';
import { firstBeforeGst } from '@/modules/app/first-before-gst';

/**
 * GET /api/app/v1/choose/quote/:id — the studio's final quote, as the
 * website's final-quote screen reads it (`finalQuoteView`): rooms and lines,
 * the bill, the stages and handover that signing locks, the studio's terms,
 * and their first quote before GST to compare. 404 unless it is issued on
 * this customer's own introduction.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const { id } = await params;
  const quote = await finalQuoteView(id.slice(0, 64), firstBeforeGst);
  return quote ? json({ ok: true, quote }) : fail(404, 'We could not find that quote on your project.');
}
