import { addressOf } from '@/modules/rate-limit/store';
import { takeGeneric } from '@/modules/studio-intake/intake';
import { formToObject } from '@/modules/studio-intake/payloads';

/**
 * POST /api/studio/intake/[connectionId] — a lead from the studio's website,
 * a portal, a WhatsApp tool, Zapier or Pabbly (docs/studio-os/LEAD-INTAKE.md).
 *
 * The door's key in header `x-oi-key` or `?key=`. JSON, form-encoded or
 * multipart, with whatever field names the sender uses (`payloads.ts`
 * `parseGeneric`). Answers `{ ok: true, status: "landed" | "duplicate" |
 * "test" | "already_received" }`, or `{ ok: false, error }` with 401 (wrong
 * key), 403 (turned off), 404, 413, 422 (nothing to call or write to) or 429.
 *
 * Open to any origin (CORS `*`): a website's own page posts here with
 * `fetch`. The key is what opens the door, not where the post came from. A
 * plain HTML form (no script) gets a short thank-you page instead of JSON.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A lead is a few hundred bytes. Sixty-four kilobytes is a lead with an essay attached. */
const MAX_BYTES = 64 * 1024;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-oi-key',
  'access-control-max-age': '600',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params;
  const url = new URL(req.url);
  const key = req.headers.get('x-oi-key') || url.searchParams.get('key');
  const type = (req.headers.get('content-type') ?? '').toLowerCase();

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ ok: false, error: 'too_large' }, 413);

  let body: unknown = {};
  let fromHtmlForm = false;
  try {
    if (type.includes('application/x-www-form-urlencoded')) {
      body = formToObject(new URLSearchParams(raw));
      fromHtmlForm = true;
    } else if (type.includes('multipart/form-data')) {
      const form = await new Request(req.url, { method: 'POST', headers: { 'content-type': type }, body: raw }).formData();
      const out: Record<string, string> = {};
      for (const [k, v] of form) if (typeof v === 'string' && !(k in out)) out[k] = v;
      body = out;
      fromHtmlForm = true;
    } else if (raw.trim()) {
      body = JSON.parse(raw);
    }
  } catch {
    return json({ ok: false, error: 'unreadable_body' }, 400);
  }

  /* A key may also travel in the body (`key`), for tools that cannot set a
     header or a query string. `parseGeneric` never shows it on the lead. */
  const bodyKey = body && typeof body === 'object' && typeof (body as { key?: unknown }).key === 'string' ? (body as { key: string }).key : null;

  const reply = await takeGeneric(connectionId, key || bodyKey, body, addressOf(req.headers.get('x-forwarded-for')));

  if (fromHtmlForm && (req.headers.get('accept') ?? '').includes('text/html')) {
    const ok = reply.status === 200;
    return new Response(page(ok), { status: reply.status, headers: { ...CORS, 'content-type': 'text/html; charset=utf-8' } });
  }
  return json(reply.body, reply.status);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

/** The thank-you a plain HTML form lands on. No studio details: the page is theirs, not ours. */
function page(ok: boolean): string {
  const said = ok ? 'Thank you. We have your details and will call you back soon.' : 'Sorry, that did not go through. Please go back and try again, or call us.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${ok ? 'Thank you' : 'Not sent'}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5;color:#1f2a24;background:#fff"><p>${said}</p></body></html>`;
}
