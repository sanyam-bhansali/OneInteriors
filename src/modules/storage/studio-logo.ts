import 'server-only';

/**
 * A studio's logo, for the top of their own documents.
 *
 * ## Why this bucket is private when the logo is not a secret
 *
 * A logo is public by nature — it is on their website and their van. The
 * bucket is private anyway, because the path would otherwise be a permanent
 * public URL keyed to a studio id, and a list of those is a list of who is on
 * the roster before we have published it. The document is server-rendered, so
 * a short signed link costs nothing and leaks nothing.
 *
 * `StudioBranding.logoPath` already said as much — "Storage path, never a
 * public URL. Served through a signed link, the same way floor plans are."
 * The column has existed for a while with nothing to fill it; this is that.
 *
 * ## The size limit is about the page, not the bill
 *
 * 2 MB. A logo is a small flat image, and anything larger is a photograph
 * somebody has mistaken for one — which prints as a blurred rectangle at the
 * top of a document going to a client about a twenty-lakh job. Refusing it is
 * kinder than printing it.
 */

import { supabaseConfig } from '@/lib/env';

const BUCKET = 'studio-logos';
const MAX_BYTES = 2 * 1024 * 1024;
const SIGNED_URL_SECONDS = 300;

/**
 * SVG is deliberately absent.
 *
 * It is the best format for a logo and it is also a script-bearing document:
 * an SVG can carry JavaScript, and this one would be rendered inside a page
 * that shows a studio's pricing. Sanitising SVG properly is its own project,
 * and a PNG at 2x prints indistinguishably on paper.
 */
const ALLOWED = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

export const ACCEPTED_LOGO = 'PNG, JPG or WebP';
export const MAX_LOGO_MB = MAX_BYTES / 1024 / 1024;

function secretKey(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  return key ? key : null;
}

export function logoUploadEnabled(): boolean {
  return Boolean(secretKey()) && supabaseConfig() !== null;
}

export type LogoResult = { ok: true; path: string } | { ok: false; error: string };

export async function storeLogo(studioId: string, file: File): Promise<LogoResult> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) {
    return { ok: false, error: 'Logo upload is not switched on for this deployment yet.' };
  }

  const extension = ALLOWED.get(file.type);
  if (!extension) {
    return {
      ok: false,
      error: `We can take ${ACCEPTED_LOGO}. An SVG will not do — it can carry scripts, and this goes on a page with your pricing on it.`,
    };
  }
  if (file.size === 0) return { ok: false, error: 'That file is empty.' };
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `Over ${MAX_LOGO_MB} MB. A logo that large is usually a photograph, and it prints as a blur.`,
    };
  }

  /* A fresh name every time. The old object is removed by the caller after
     the row is updated — never before, or a failed write leaves a studio with
     a document that cannot find its logo. */
  const path = `studio_${studioId}/${crypto.randomUUID()}.${extension}`;

  try {
    const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': file.type,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'x-upsert': 'false',
      },
      body: await file.arrayBuffer(),
    });
    if (!response.ok) return { ok: false, error: 'We could not store that. Try again.' };
  } catch {
    return { ok: false, error: 'We could not reach storage. Try again in a minute.' };
  }

  return { ok: true, path };
}

/**
 * A short-lived link to a stored logo.
 *
 * No role check, unlike the other private buckets, and the reason is worth
 * stating: this is only ever called while rendering a document for the studio
 * that owns the logo, from a path read off their own branding row. There is
 * no id arriving from a browser for an attacker to change — the caller has
 * already established whose branding it is.
 */
export async function signedLogoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return null;

  try {
    const response = await fetch(
      `${config.url}/storage/v1/object/sign/${BUCKET}/${encodeURI(path)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
      },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { signedURL?: string; signedUrl?: string };
    const relative = json.signedURL ?? json.signedUrl;
    return relative ? `${config.url}/storage/v1${relative}` : null;
  } catch {
    return null;
  }
}

/** Best effort. A stranded logo costs a few kilobytes; a failed delete that took the row would cost the document. */
export async function removeLogo(path: string | null): Promise<void> {
  if (!path) return;
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return;

  try {
    await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
  } catch {
    /* Nothing worth logging — the path names the studio. */
  }
}
