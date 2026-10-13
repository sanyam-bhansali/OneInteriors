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
import { getCurrentUser, hasRole } from '@/modules/auth/session';
import { myStudioId } from '@/modules/studio/tenancy';
import { MAX_LOGO_BYTES, MAX_LOGO_MB, LOGO_TYPES, ACCEPTED_LOGO, MAX_BRAND_PAGE_BYTES, MAX_BRAND_PAGE_MB } from './logo-limits';

const BUCKET = 'studio-logos';
const SIGNED_URL_SECONDS = 300;

/* From the pure sibling, so the number in the settings copy and the number
   in this check cannot drift. See logo-limits.ts for why it is separate. */
const MAX_BYTES = MAX_LOGO_BYTES;

const ALLOWED = new Map(Object.entries(LOGO_TYPES));

/* Re-exported so server callers have one import for the whole feature. */
export { ACCEPTED_LOGO, MAX_LOGO_MB } from './logo-limits';

function secretKey(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  return key ? key : null;
}

export function logoUploadEnabled(): boolean {
  return Boolean(secretKey()) && supabaseConfig() !== null;
}

export type LogoResult = { ok: true; path: string } | { ok: false; error: string };

export async function storeLogo(studioId: string, file: File): Promise<LogoResult> {
  return storeImage(studioId, file, '', MAX_BYTES, `Over ${MAX_LOGO_MB} MB. A logo that large is usually a photograph, and it prints as a blur.`, 'Logo upload');
}

/**
 * A full-page brand image (Settings → Quotation PDF → Brand pages), in the
 * same private bucket as the logo, under the studio's `brand/` folder, so the
 * same signed-link rule covers it.
 */
export async function storeBrandPage(studioId: string, file: File): Promise<LogoResult> {
  return storeImage(
    studioId,
    file,
    'brand/',
    MAX_BRAND_PAGE_BYTES,
    `Over ${MAX_BRAND_PAGE_MB} MB. Export the page as a JPG at print size (about 1240 × 1754 pixels for A4) and it will be well under.`,
    'Uploading brand pages',
  );
}

async function storeImage(studioId: string, file: File, folder: '' | 'brand/', maxBytes: number, tooBig: string, what: string): Promise<LogoResult> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) {
    return { ok: false, error: `${what} is not switched on for this deployment yet.` };
  }

  const extension = ALLOWED.get(file.type);
  if (!extension) {
    return {
      ok: false,
      error: `We can take ${ACCEPTED_LOGO}. An SVG will not do — it can carry scripts, and this goes on a page with your pricing on it.`,
    };
  }
  if (file.size === 0) return { ok: false, error: 'That file is empty.' };
  if (file.size > maxBytes) return { ok: false, error: tooBig };

  /* A fresh name every time. The old object is removed by the caller after
     the row is updated — never before, or a failed write leaves a studio with
     a document that cannot find its logo. */
  const path = `studio_${studioId}/${folder}${crypto.randomUUID()}.${extension}`;

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
 * ## The check is in the path, and now it is enforced
 *
 * Every object in this bucket is written to `studio_<studioId>/…`, and this
 * function refuses any path that is not the signed-in studio's own prefix.
 *
 * It did not, until now. The argument was that callers only ever pass
 * `StudioBranding.logoPath` read off the already-authorised studio's own row,
 * so no browser-supplied id could reach it — which was true, and was a
 * comment rather than a check. One future caller passing a request parameter
 * would have turned it into a cross-studio read of the roster, which is the
 * thing the bucket is private to prevent. `docs/DATA-ARCHITECTURE.md` called
 * this out as the one bucket whose boundary was convention.
 *
 * Ops can sign any path: they review these.
 */
export async function signedLogoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return null;

  const user = await getCurrentUser();
  if (!hasRole(user, 'OPS') && !hasRole(user, 'ADMIN')) {
    const studioId = await myStudioId();
    /* Prefix, exactly as `storeLogo` writes it. A path that does not start
       with this studio's own folder is not theirs to read, whoever handed it
       over. */
    if (!studioId || !path.startsWith(`studio_${studioId}/`)) return null;
  }
  return signPath(path);
}

/**
 * The studio's logo for its quotation (screen and PDF), for anyone who may
 * quote for that studio, a salesperson included (owner, 13 Oct 2026: sales
 * PDFs carry the logo too). Like the brand pages: the caller passes the
 * studio its quotation query was scoped to, and only that studio's own
 * folder is signed, so no other studio's logo can be read through it.
 */
export async function signedQuoteLogoUrl(path: string | null, studioId: string | null): Promise<string | null> {
  if (!path || !studioId || !path.startsWith(`studio_${studioId}/`)) return null;
  return signPath(path);
}

/**
 * Short links to a studio's brand pages, for the quotation PDF.
 *
 * Checked against the studio the quotation belongs to (the caller passes the
 * studio its quotation query was scoped to, so a salesperson printing their
 * own client's quotation gets their studio's pages), and only inside that
 * studio's `brand/` folder: a path anywhere else is not signed. In order;
 * a page that cannot be signed is left out rather than printed broken.
 */
export async function signedBrandPageUrls(paths: readonly string[], studioId: string | null): Promise<string[]> {
  if (!studioId || paths.length === 0) return [];
  const mine = paths.filter((p) => p.startsWith(`studio_${studioId}/brand/`));
  const urls = await Promise.all(mine.map((p) => signPath(p)));
  return urls.filter((u): u is string => Boolean(u));
}

/** A short signed link to an object in this bucket. The caller has already checked whose it is. */
async function signPath(path: string): Promise<string | null> {
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
