import { after } from 'next/server';
import { takeGoogle } from '@/modules/studio-intake/intake';

/**
 * POST /api/studio/intake/google/[connectionId] — a Google Ads lead form's
 * webhook (docs/studio-os/LEAD-INTAKE.md). Google posts JSON with
 * `google_key` (the door's key, pasted as the "Key" in Google Ads),
 * `lead_id`, `user_column_data` and `is_test`.
 *
 * Verify, claim, answer 200 at once; the lead is landed in `after()`.
 * 403 for a wrong key, so "Send test data" in Google Ads shows the owner a
 * failure while setting it up rather than a false success. A test is
 * recorded on Settings → Lead sources and not put on the board.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 64 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params;
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return Response.json({ error: 'too_large' }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'unreadable_body' }, { status: 400 });
  }

  const { reply, work } = await takeGoogle(connectionId, body);
  if (work) {
    after(async () => {
      try {
        await work();
      } catch (error) {
        console.error('[intake/google] work failed', error instanceof Error ? error.message : error);
      }
    });
  }
  return Response.json(reply.body, { status: reply.status });
}
