import { sameOrigin } from '@/modules/project/site-http';
import { startLeadExport } from '@/modules/studio-sales/lead-export';

/**
 * GET /api/studio/leads/export?<the leads list's query> — the leads list,
 * with its current filters and sort, as a CSV download (improvement 8,
 * owner 22 Oct 2026). The studio owner only; one audit line per download
 * (modules/studio-sales/lead-export.ts). A route rather than a server
 * action because the browser has to save it, and a server action's
 * response is not a file.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!sameOrigin(req)) return new Response('Not from here.', { status: 403, headers: { 'cache-control': 'no-store' } });
  const started = await startLeadExport(new URL(req.url).searchParams);
  if (!started.ok) return new Response(started.error, { status: started.status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  return new Response(started.body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${started.filename}"`,
      // Never a CDN copy: this is the studio's customers behind a role check.
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
    },
  });
}
