import 'server-only';

/**
 * A crew's KYC scans and agreement (Studio OS Phase 3): the private
 * `crew-kyc` bucket, under `studio_<studioId>/crew_<crewId>/<doc>-<uuid>.<ext>`.
 * Owner and accounts only — the caller checks `crew.edit` before anything
 * here runs. Nothing has a public URL; a scan opens through a signed link
 * that lasts ten minutes, made for a page that has already checked the role.
 *
 * Uploaded through a server action (≤ 3.8 MB, inside the 4 MB action limit;
 * a phone photo of a card is far smaller), so the type and size are checked
 * on the server before the bytes go anywhere (studio-crews/kyc.ts).
 *
 * ## What Sanyam sets up in Supabase (not created from here)
 *
 * Storage → New bucket `crew-kyc`: Private; file size limit 4 MB; allowed MIME
 * types `application/pdf, image/jpeg, image/png, image/webp`. No policies for
 * `anon` or `authenticated`.
 *
 * In local development with no storage keys, the scan is not stored and the
 * path starts `dev-unstored/`, so the screens can be walked end to end.
 */

import { isProduction, supabaseConfig } from '@/lib/env';
import { KYC_TYPES, kycFileError, kycPath, type KycDoc } from '@/modules/studio-crews/kyc';

const BUCKET = 'crew-kyc';
const SIGNED_URL_SECONDS = 10 * 60;

const secretKey = () => process.env.SUPABASE_SECRET_KEY?.trim() || null;

export type KycStore = { ok: true; path: string } | { ok: false; error: string };

export async function storeKycScan(studioId: string, crewId: string, doc: KycDoc, file: File): Promise<KycStore> {
  const bad = kycFileError(file);
  if (bad) return { ok: false, error: bad };
  const ext = KYC_TYPES.get(file.type)!;
  const path = kycPath(studioId, crewId, doc, crypto.randomUUID(), ext);
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
    if (!res.ok) return { ok: false, error: 'We could not store that scan. Try again.' };
  } catch {
    return { ok: false, error: 'We could not reach storage. Try again in a minute.' };
  }
  return { ok: true, path };
}

/** Signed links for scans the caller has already authorised. Missing = could not be made. */
export async function signedKycLinks(paths: readonly string[]): Promise<Map<string, string>> {
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
    /* no links: the page still says a scan is on file */
  }
  return out;
}
