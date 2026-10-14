import 'server-only';

/**
 * Where a lead's files are kept (Studio OS Phase 1): the floor plan the
 * client sent on WhatsApp, or anything else, in the private `lead-files`
 * bucket under `studio_<studioId>/lead_<clientId>/<uuid>.<ext>`.
 *
 * Same shape as site mode's photos (project/site-log-storage.ts): the
 * browser asks for a one-time signed upload URL (after the member is checked
 * against the lead) and PUTs the file straight to Supabase Storage, so a
 * 15 MB PDF never passes through a server action's 4 MB body limit. Reads
 * are short signed links, made only for somebody who may see the lead.
 *
 * ## What Sanyam sets up in Supabase (not created from here)
 *
 * Storage → New bucket `lead-files`: Private; file size limit 15 MB; allowed
 * MIME types `application/pdf, image/jpeg, image/png, image/webp,
 * image/heic`. No policies for `anon` or `authenticated`.
 *
 * In local development with no storage keys, uploads are skipped and the
 * path starts `dev-unstored/`, so the screens can be walked end to end.
 */

import { isProduction, supabaseConfig } from '@/lib/env';
import { leadFilePath } from '@/modules/studio-sales/lead-rules';

const BUCKET = 'lead-files';
const SIGNED_URL_SECONDS = 10 * 60;

const secretKey = () => process.env.SUPABASE_SECRET_KEY?.trim() || null;

export function leadStorageOn(): boolean {
  return Boolean(secretKey()) && supabaseConfig() !== null;
}

const unstored = () => !leadStorageOn() && !isProduction();

export type LeadTicket = { ok: true; path: string; url: string | null } | { ok: false; error: string };

/** A one-time URL the browser PUTs one file to. `url: null` = local development, nothing to upload. */
export async function leadUploadTicket(studioId: string, clientId: string, ext: string): Promise<LeadTicket> {
  const uuid = crypto.randomUUID();
  const path = leadFilePath(studioId, clientId, uuid, ext);
  if (unstored()) return { ok: true, path: `dev-unstored/${path}`, url: null };
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return { ok: false, error: 'File storage is not switched on for this deployment yet.' };
  try {
    const res = await fetch(`${config.url}/storage/v1/object/upload/sign/${BUCKET}/${encodeURI(path)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) return { ok: false, error: 'We could not get a place to store that file. Try again.' };
    const json = (await res.json()) as { url?: string };
    if (!json.url) return { ok: false, error: 'We could not get a place to store that file. Try again.' };
    return { ok: true, path, url: `${config.url}/storage/v1${json.url}` };
  } catch {
    return { ok: false, error: 'We could not reach storage. Try again in a minute.' };
  }
}

/** Signed read links by path, for files the caller has already authorised. Missing = could not be made. */
export async function signedLeadFileLinks(paths: readonly string[]): Promise<Map<string, string>> {
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
    /* no links: the list still shows the names */
  }
  return out;
}

/** A stored file's bytes (for "Read rooms"). Null when it cannot be read. */
export async function readLeadFile(path: string): Promise<Uint8Array | null> {
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

/** Whether a finished upload is really in the bucket (a path alone proves nothing). */
export async function leadFileExists(path: string): Promise<boolean> {
  if (path.startsWith('dev-unstored/')) return unstored();
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return false;
  try {
    const res = await fetch(`${config.url}/storage/v1/object/info/${BUCKET}/${encodeURI(path)}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Erase stored files (removing one, or the bin purge). True when storage accepted it or there was nothing stored. */
export async function removeLeadFiles(paths: readonly string[]): Promise<boolean> {
  const stored = paths.filter((p) => p && !p.startsWith('dev-unstored/'));
  if (stored.length === 0) return true;
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return false;
  try {
    const res = await fetch(`${config.url}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: stored }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
