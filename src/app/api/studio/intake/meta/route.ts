import { timingSafeEqual } from 'node:crypto';
import { after } from 'next/server';
import { takeMeta } from '@/modules/studio-intake/intake';

/**
 * Meta lead ads (Facebook and Instagram) for every studio, one callback
 * (docs/studio-os/LEAD-INTAKE.md). The Meta app is subscribed to each
 * connected Page's `leadgen` field with this URL.
 *
 * GET: Meta's handshake. Answers `hub.challenge` when `hub.verify_token`
 * equals env `META_VERIFY_TOKEN`, 403 otherwise (and always 403 when the
 * token is not set: an empty token must not match an empty guess).
 *
 * POST: checks `X-Hub-Signature-256` against env `META_APP_SECRET`, finds
 * the studio by the Page id, claims each leadgen id once, answers 200, and
 * fetches and lands each lead in `after()`. ALWAYS 200, whatever happened:
 * Meta retries anything else, and what went wrong is recorded on the
 * studio's Settings → Lead sources instead.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 256 * 1024;

export function GET(req: Request) {
  const u = new URL(req.url);
  const expected = process.env.META_VERIFY_TOKEN?.trim();
  const given = u.searchParams.get('hub.verify_token') ?? '';
  if (u.searchParams.get('hub.mode') === 'subscribe' && expected && same(given, expected)) {
    return new Response(u.searchParams.get('hub.challenge') ?? '', { headers: { 'content-type': 'text/plain' } });
  }
  return new Response('forbidden', { status: 403 });
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return ok();
    const work = await takeMeta(raw, req.headers.get('x-hub-signature-256'));
    if (work.length > 0) {
      after(async () => {
        for (const job of work) {
          try {
            await job();
          } catch (error) {
            console.error('[intake/meta] job failed', error instanceof Error ? error.message : error);
          }
        }
      });
    }
  } catch (error) {
    console.error('[intake/meta] post failed', error instanceof Error ? error.message : error);
  }
  return ok();
}

function ok() {
  return Response.json({ ok: true });
}

function same(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
