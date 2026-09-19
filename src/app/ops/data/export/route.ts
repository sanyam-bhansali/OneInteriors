import { journeyRows, toCsv } from '@/modules/quotation/journey-export';
import { getCurrentUser, hasRole } from '@/modules/auth/session';

/**
 * The CSV itself.
 *
 * A route rather than a server action because the browser has to be able to
 * save it, and because ops will want to bookmark it. `journeyRows` re-checks
 * the role itself and returns nothing without it; the 403 here is so a
 * signed-out request gets an answer rather than an empty spreadsheet that
 * looks like "we have no data".
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!hasRole(user, 'OPS')) {
    return new Response('Not for you.', { status: 403 });
  }

  const rows = await journeyRows();
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="one-interiors-journey-${stamp}.csv"`,
      // Never a CDN copy: this is customer data behind a role check.
      'cache-control': 'no-store, private',
    },
  });
}
