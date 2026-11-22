import 'server-only';

/**
 * Employees' documents (owner, 21 Nov 2026): Aadhaar, PAN, offer letter,
 * address proof, photo. Kept in the private `crew-kyc` bucket (made for crews'
 * ID scans, already private with no anon or authenticated policies) under
 * `studio_<studioId>/staff_<memberId>/`, so nothing new needs setting up in
 * Supabase. Owner and accounts only — the caller checks before anything here
 * runs. A file opens through a signed link that lasts ten minutes.
 *
 * In local development with no storage keys the file is not stored and the
 * path starts `dev-unstored/`, so the screens can be walked end to end.
 */

import { isProduction, supabaseConfig } from '@/lib/env';
import { STAFF_FILE_TYPES, staffDocPath, type StaffDocKind } from '@/modules/staff/rules';

const BUCKET = 'crew-kyc';
const SIGNED_URL_SECONDS = 10 * 60;
const secretKey = () => process.env.SUPABASE_SECRET_KEY?.trim() || null;

export async function storeStaffDoc(studioId: string, memberId: string, kind: StaffDocKind, file: File): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const ext = STAFF_FILE_TYPES.get(file.type);
  if (!ext) return { ok: false, error: 'A document can be a JPG, PNG, WebP or PDF.' };
  const path = staffDocPath(studioId, memberId, kind, crypto.randomUUID(), ext);
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) {
    if (!isProduction()) return { ok: true, path: `dev-unstored/${path}` };
    return { ok: false, error: 'File storage is not switched on for this deployment yet.' };
  }
  try {
    const res = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': file.type, 'x-upsert': 'false' },
      body: await file.arrayBuffer(),
    });
    if (!res.ok) return { ok: false, error: 'We could not store that file. Try again.' };
  } catch {
    return { ok: false, error: 'We could not reach storage. Try again in a minute.' };
  }
  return { ok: true, path };
}

/** Deletes a stored file. Best effort: the row is marked removed either way. */
export async function deleteStaffDoc(path: string): Promise<void> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key || path.startsWith('dev-unstored/')) return;
  try {
    await fetch(`${config.url}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [path] }),
    });
  } catch {
    /* the row is marked removed; the file can be cleaned up later */
  }
}

/** Signed links for files the caller has already authorised. */
export async function signedStaffLinks(paths: readonly string[]): Promise<Map<string, string>> {
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
    /* no links: the page still lists the files */
  }
  return out;
}
