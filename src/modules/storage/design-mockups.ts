import 'server-only';

/**
 * Room mock-up pictures (Design DNA, owner 4 Nov 2026): the private
 * `design-mockups` bucket, under `brief_<briefId>/<room>-<uuid>.<ext>`.
 * Only the customer they were drawn for sees them, through a signed link that
 * lasts an hour, made by a route that has already checked whose brief it is.
 *
 * ## What Sanyam sets up in Supabase (not created from here)
 *
 * Storage → New bucket `design-mockups`: Private; file size limit 8 MB;
 * allowed MIME types `image/png, image/jpeg, image/webp`. No policies for
 * `anon` or `authenticated`.
 *
 * Off production with no storage keys, the picture is kept inline as a data
 * URL so the screens can be walked end to end on a laptop.
 */

import { isProduction, supabaseConfig } from '@/lib/env';

const BUCKET = 'design-mockups';
const SIGNED_URL_SECONDS = 60 * 60;

const secretKey = () => process.env.SUPABASE_SECRET_KEY?.trim() || null;

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

export type MockupStore = { ok: true; path: string } | { ok: false; error: string };

export async function storeMockup(briefId: string, room: string, bytes: Uint8Array, mediaType: string): Promise<MockupStore> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) {
    if (isProduction()) return { ok: false, error: 'Picture storage is not switched on for this deployment yet.' };
    return { ok: true, path: `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}` };
  }
  const path = `brief_${briefId}/${room.toLowerCase()}-${crypto.randomUUID()}.${EXT[mediaType] ?? 'png'}`;
  try {
    const res = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': mediaType, 'x-upsert': 'false' },
      body: Buffer.from(bytes),
    });
    if (!res.ok) return { ok: false, error: 'We could not save this picture. Try again.' };
  } catch {
    return { ok: false, error: 'We could not reach storage. Try again in a minute.' };
  }
  return { ok: true, path };
}

/** Links for pictures the caller has already been checked to own. */
export async function mockupLinks(paths: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const p of paths) if (p.startsWith('data:')) out.set(p, p);
  const config = supabaseConfig();
  const key = secretKey();
  const wanted = [...new Set(paths.filter((p) => p && !p.startsWith('data:')))];
  if (!config || !key || wanted.length === 0) return out;
  try {
    const res = await fetch(`${config.url}/storage/v1/object/sign/${BUCKET}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS, paths: wanted }),
    });
    if (!res.ok) return out;
    const json = (await res.json()) as { path?: string | null; signedURL?: string | null; signedUrl?: string | null }[];
    json.forEach((r, i) => {
      const u = r.signedURL ?? r.signedUrl;
      const p = r.path ?? wanted[i];
      if (u && p) out.set(p, `${config.url}/storage/v1${u}`);
    });
  } catch {
    /* no links: the page shows the card without the picture */
  }
  return out;
}
