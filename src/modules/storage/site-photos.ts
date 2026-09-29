import 'server-only';

/**
 * Site photographs on the project tracker (build queue item 22).
 *
 * The inside of a customer's home, so the bucket is PRIVATE, like the floor
 * plans: nothing here has a public URL. A photo is shown only through a
 * signed link that expires in minutes, fetched for a page the caller has
 * already authorised (the customer's own "Your home", the studio's own
 * project, ops). The bucket `site-photos` is created private in Supabase
 * alongside the others (docs/DATA-ARCHITECTURE.md).
 */

import { supabaseConfig } from '@/lib/env';

const BUCKET = 'site-photos';
const MAX_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTOS_PER_UPDATE = 6;
const SIGNED_URL_SECONDS = 10 * 60;

const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export const ACCEPTED_SITE_PHOTOS = 'JPG, PNG or WebP';

function secretKey(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  return key ? key : null;
}

export function sitePhotosEnabled(): boolean {
  return Boolean(secretKey()) && supabaseConfig() !== null;
}

export type SitePhotoResult = { ok: true; path: string } | { ok: false; error: string };

export async function storeSitePhoto(projectId: string, file: File): Promise<SitePhotoResult> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return { ok: false, error: 'Site photos are not switched on for this deployment yet.' };
  const extension = ALLOWED.get(file.type);
  if (!extension) return { ok: false, error: `We can take ${ACCEPTED_SITE_PHOTOS}. Export an iPhone HEIC as JPG first.` };
  if (file.size === 0) return { ok: false, error: 'One of the photos is empty.' };
  if (file.size > MAX_BYTES) return { ok: false, error: `Each photo can be up to ${MAX_BYTES / 1024 / 1024} MB.` };

  const path = `project_${projectId}/${crypto.randomUUID()}.${extension}`;
  try {
    const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': file.type, 'x-upsert': 'false' },
      body: await file.arrayBuffer(),
    });
    if (!response.ok) return { ok: false, error: 'We could not store a photo. Try again.' };
  } catch {
    return { ok: false, error: 'We could not reach storage. Try again in a minute.' };
  }
  return { ok: true, path };
}

/** Signed links for paths the caller has already authorised the viewer to see. */
export async function signedSitePhotoUrls(paths: string[]): Promise<string[]> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key || paths.length === 0) return [];
  try {
    const response = await fetch(`${config.url}/storage/v1/object/sign/${BUCKET}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS, paths }),
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { signedURL?: string | null; signedUrl?: string | null }[];
    return json
      .map((r) => r.signedURL ?? r.signedUrl)
      .filter((u): u is string => Boolean(u))
      .map((u) => `${config.url}/storage/v1${u}`);
  } catch {
    return [];
  }
}
