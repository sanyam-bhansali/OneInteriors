import { gate, json, signedIn } from '@/modules/app-api/http';
import { chooseView } from '@/modules/portal/choose';
import { chooseApiView } from '@/modules/portal/choose-api';

/**
 * GET /api/app/v1/choose — Choose & sign for this customer: the studios the
 * expert introduced, each with its visits and final quote, from the same
 * `chooseView` the website's /app/choose reads. `view` is null until they
 * have a brief on their account.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  const view = await chooseView();
  return json({ ok: true, view: view ? chooseApiView(view) : null });
}
