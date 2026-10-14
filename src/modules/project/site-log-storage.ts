import 'server-only';

/**
 * Where site-mode photos and voice notes are kept: the private
 * `site-photos` bucket the tracker already uses (storage/site-photos.ts),
 * under the project's own prefix —
 *
 *   project_<id>/site/<uuid>.jpg     photos from the daily update
 *   project_<id>/voice/<uuid>.webm   voice notes (never shown to the customer)
 *
 * ## Why signed upload URLs
 *
 * A server action body is capped at 4 MB (next.config.ts) and a phone on
 * site sends several photos and recordings. So the phone asks
 * `/api/studio/site/upload` for a one-time signed upload URL per file
 * (checked against `update.post` on that project) and PUTs the file straight
 * to Supabase Storage. Nothing large passes through our functions.
 *
 * ## What Sanyam sets up (not created from here: we hold no key for it)
 *
 * The bucket already exists for the tracker's photos. In Supabase →
 * Storage → `site-photos`: keep it Private; set the file size limit to
 * 8 MB; allowed MIME types `image/jpeg, image/png, image/webp, audio/webm,
 * audio/mp4, audio/ogg, audio/mpeg`. No storage policies for `anon` or
 * `authenticated`: every read is a signed link we make with the secret key,
 * every write a signed upload URL we hand out after checking the member.
 *
 * In local development with no storage keys, uploads are skipped and the
 * path is `dev-unstored/…`, so the screens can be walked through end to end.
 */

import { isProduction, supabaseConfig } from '@/lib/env';
import { uploadPath } from './site-log-rules';

const BUCKET = 'site-photos';
const SIGNED_URL_SECONDS = 10 * 60;

export const UPLOAD_TYPES: Record<'site' | 'voice', Record<string, string>> = {
  site: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  voice: { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3' },
};

function secretKey(): string | null {
  return process.env.SUPABASE_SECRET_KEY?.trim() || null;
}

export function storageOn(): boolean {
  return Boolean(secretKey()) && supabaseConfig() !== null;
}

/** Local development with no storage: uploads are skipped, paths say so. */
export function unstoredAllowed(): boolean {
  return !storageOn() && !isProduction();
}

export type UploadTicket = { ok: true; path: string; url: string | null } | { ok: false; error: 'type' | 'storage' };

/** A one-time URL the phone PUTs one file to. `url: null` = local development, nothing to upload. */
export async function uploadTicket(projectId: string, kind: 'site' | 'voice', contentType: string): Promise<UploadTicket> {
  const base = contentType.split(';')[0]!.trim().toLowerCase();
  const ext = UPLOAD_TYPES[kind][base];
  if (!ext) return { ok: false, error: 'type' };
  const uuid = crypto.randomUUID();
  if (unstoredAllowed()) return { ok: true, path: `dev-unstored/${kind}/${uuid}.${ext}`, url: null };
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return { ok: false, error: 'storage' };
  const path = uploadPath(projectId, kind, uuid, ext);
  try {
    const res = await fetch(`${config.url}/storage/v1/object/upload/sign/${BUCKET}/${encodeURI(path)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) return { ok: false, error: 'storage' };
    const json = (await res.json()) as { url?: string };
    if (!json.url) return { ok: false, error: 'storage' };
    return { ok: true, path, url: `${config.url}/storage/v1${json.url}` };
  } catch {
    return { ok: false, error: 'storage' };
  }
}

/**
 * Signed read links by path, for paths the caller has already authorised
 * the viewer to see. A Map, so a path that could not be signed (or a
 * `dev-unstored/` one) is simply missing — and each photo keeps its own
 * sentence even when its picture cannot be shown.
 */
export async function signedPhotoMap(paths: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const config = supabaseConfig();
  const key = secretKey();
  const wanted = [...new Set(paths.filter((p) => p && !p.startsWith('dev-unstored/')))];
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
    /* no links: the page shows the sentences without pictures */
  }
  return out;
}

/** A voice note's bytes, for a real speech provider. Null when it cannot be read. */
export async function readVoice(path: string): Promise<Uint8Array | null> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key || path.startsWith('dev-unstored/')) return null;
  try {
    const res = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Per site log, per photo (in order), its signed link or "" — the customer projection's `siteLogPhotos`. One storage round trip. */
export async function siteLogPhotoLinks(logs: readonly { photos: readonly { storagePath: string }[] }[]): Promise<string[][]> {
  const map = await signedPhotoMap(logs.flatMap((l) => l.photos.map((p) => p.storagePath)));
  return logs.map((l) => l.photos.map((p) => map.get(p.storagePath) ?? ''));
}
