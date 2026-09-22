import 'server-only';

/**
 * Photographs of a studio's completed work.
 *
 * ## This bucket is PUBLIC, and it is the only one that is
 *
 * The quotation archive and the business-proof bucket are private, read only
 * by ops through a five-minute signed URL. These are the opposite: they are
 * the pictures on a public studio profile, the thing a homeowner scrolls
 * before they read a word. A signed URL would expire in the middle of
 * somebody browsing, and signing every image on a listing page would be a
 * round trip per photograph.
 *
 * That difference has to be deliberate rather than inherited, so it is stated
 * here and the bucket name is different. **Nothing that is not intended for
 * strangers goes in this bucket.** A GST certificate uploaded here would be
 * on the open internet with a guessable-by-nobody but permanent URL, which is
 * exactly the accident a shared bucket invites — hence three buckets rather
 * than folders in one.
 *
 * ## What is stored, and what is not
 *
 * The object path goes in `PortfolioProject.images`, as a full public URL.
 * Order in that array is the display order and the first is the cover, which
 * is why reordering is a write to the array rather than a column.
 *
 * ## Degrading
 *
 * With no secret key, upload is off and the project form says so. A studio
 * can still add a project with no photographs — the portfolio step counts
 * projects, not pictures, and blocking on an unconfigured bucket would stop
 * onboarding for a deployment problem that is ours.
 */

import { supabaseConfig } from '@/lib/env';

const BUCKET = 'portfolio-images';

/**
 * 8 MB a photograph. Generous for a phone picture and firm enough that a
 * studio cannot put a 40 MB TIFF straight off a camera onto a page a
 * homeowner will open on mobile data.
 */
const MAX_BYTES = 8 * 1024 * 1024;

/** Per project. Twenty is more than anybody scrolls; it is a stop, not a target. */
export const MAX_IMAGES_PER_PROJECT = 20;

/**
 * Pictures only, and only the three formats every browser renders.
 *
 * HEIC is deliberately absent even though iPhones produce it: Safari shows
 * it, Chrome on Android does not, and an image that renders for the studio
 * who uploaded it and not for the customer looking at their profile is worse
 * than a refusal at the point of upload.
 */
const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export const ACCEPTED_IMAGES = 'JPG, PNG or WebP';
export const MAX_IMAGE_MB = MAX_BYTES / 1024 / 1024;

function secretKey(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  return key ? key : null;
}

export function imageUploadEnabled(): boolean {
  return Boolean(secretKey()) && supabaseConfig() !== null;
}

export type ImageResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Put one photograph in the bucket and return the URL to store.
 *
 * Returns rather than throws: a studio dragging in eight pictures at once
 * should not lose the other seven because one was a HEIC.
 */
export async function storePortfolioImage(studioId: string, file: File): Promise<ImageResult> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) {
    return { ok: false, error: 'Photographs are not switched on for this deployment yet.' };
  }

  const extension = ALLOWED.get(file.type);
  if (!extension) {
    return {
      ok: false,
      error: `${safeName(file.name)} — we can take ${ACCEPTED_IMAGES}. An iPhone HEIC will not show on Android, so please export it as JPG first.`,
    };
  }
  if (file.size === 0) return { ok: false, error: `${safeName(file.name)} is empty.` };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `${safeName(file.name)} is over ${MAX_IMAGE_MB} MB.` };
  }

  // Generated, never derived from what the studio called the file.
  const path = `studio_${studioId}/${crypto.randomUUID()}.${extension}`;

  try {
    const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': file.type,
        /* A year. These are immutable — a new photograph gets a new uuid —
           so there is nothing to invalidate and every repeat view of a
           profile should come from the CDN rather than from us. */
        'Cache-Control': 'public, max-age=31536000, immutable',
        'x-upsert': 'false',
      },
      body: await file.arrayBuffer(),
    });
    if (!response.ok) {
      return { ok: false, error: `We could not store ${safeName(file.name)}. Try again.` };
    }
  } catch {
    return { ok: false, error: 'We could not reach storage. Try again in a minute.' };
  }

  return { ok: true, url: `${config.url}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}` };
}

/**
 * Remove a photograph.
 *
 * Takes the stored URL rather than a path, because the URL is what the
 * database holds and asking every caller to parse one back into a path is how
 * the parsing ends up written twice and differently.
 *
 * Best-effort. A stranded object costs a few kilobytes; a failed delete that
 * took the array entry with it would leave a picture on the public internet
 * that nothing references and nobody can find to remove.
 */
export async function removePortfolioImage(url: string): Promise<void> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return;

  const marker = `/object/public/${BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return;
  const path = url.slice(at + marker.length);

  try {
    await fetch(`${config.url}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
  } catch {
    /* Nothing to do, and nothing worth logging — the path names the studio. */
  }
}

/**
 * Is this one of our URLs?
 *
 * Used before writing anything into `images`, because that array ends up in
 * `<img src>` on a public page. Without this check an arbitrary string
 * arriving from a form would be rendered as a URL — which is a way to have
 * our own profile pages load somebody else's tracker, and to have a studio
 * hotlink an image they do not control that later becomes something else.
 */
export function isOurImageUrl(url: string): boolean {
  const config = supabaseConfig();
  if (!config) return false;
  return url.startsWith(`${config.url}/storage/v1/object/public/${BUCKET}/`);
}

function safeName(name: string): string {
  return name.replace(/[/\\]/g, '_').slice(0, 80) || 'that file';
}
