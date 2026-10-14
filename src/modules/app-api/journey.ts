import 'server-only';

import { briefFromJson } from '@/modules/brief/from-json';
import type { Brief } from '@/modules/brief/types';
import { fail, readJson } from './http';

/**
 * The body every public journey route takes: `{ brief, ... }`, the website's
 * `Brief` shape (partial while the quiz is unfinished), made safe by
 * `briefFromJson`. The rest of the body comes back for the route to read.
 */
export async function briefFrom(
  req: Request,
): Promise<{ ok: true; brief: Brief; body: Record<string, unknown> } | { ok: false; response: Response }> {
  const raw = await readJson(req);
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const brief = briefFromJson(body.brief);
  if (!brief) return { ok: false, response: fail(400, 'That brief could not be read.') };
  return { ok: true, brief, body };
}
