import { gate, json, signedIn } from '@/modules/app-api/http';
import { customerProjects } from '@/modules/portal/project-store';

/**
 * GET /api/app/v1/project — the signed-in customer's projects: stages,
 * payment plan, site updates (photos as short-lived signed links), decisions
 * and snags. An empty list means no project has started yet.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = gate();
  if (!g.ok) return g.response;
  const me = await signedIn();
  if (!me.ok) return me.response;
  return json({ ok: true, projects: await customerProjects(me.user.id) });
}
