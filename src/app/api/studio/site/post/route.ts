import { opening, refuse, reply } from '@/modules/project/site-http';
import { postSiteLog } from '@/modules/project/site-log';

/**
 * POST /api/studio/site/post — the phone's queued post: today's update or
 * nobody on site (site-log-rules.ts `parsePost` for the shape). Safe to
 * send twice: the same `clientRef` lands once. Photos and voice notes are
 * already in storage (they went up through /api/studio/site/upload); this
 * carries only their paths.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const open = await opening(req);
  if (!open.ok) return open.response;
  const r = await postSiteLog(open.body);
  if (!r.ok) return refuse(r.error);
  return reply({ ok: true, post: r.post });
}
