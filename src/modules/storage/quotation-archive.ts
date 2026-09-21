import 'server-only';

/**
 * Storage for the past quotations a studio sends us.
 *
 * ## What is in this bucket, and why it is the most sensitive thing we hold
 *
 * A studio's back catalogue of quotations is its pricing, its margins and its
 * client list in one place. A competitor would pay for it. So:
 *
 *  - The bucket is **private**. There is no public URL, ever.
 *  - Reading is ops-only, through `signedUrlForFile`, which checks the role
 *    itself rather than trusting a caller to have done it. Five minutes.
 *  - The studio that uploaded a file cannot read it back either. That is
 *    deliberate and slightly surprising: giving them a download link means an
 *    account takeover leaks the archive, and they already have these files —
 *    they sent them. What they get instead is the filename, so they can tell
 *    which one we could not read.
 *
 * ## Why paths are keyed on the studio
 *
 * `studio_<id>/<uuid>.<ext>`. The object name is ours, generated, never
 * derived from what the studio called the file — an attacker-supplied name
 * must not be able to steer a write into another studio's folder or out of
 * the bucket. The original name is kept in Postgres, for display only.
 *
 * ## Degrading
 *
 * With no secret key configured, upload is simply off and the studio sees the
 * manual rate form with no mention of an archive. Same posture as floor plans:
 * a missing environment variable removes a feature rather than breaking a
 * page.
 */

import { supabaseConfig } from '@/lib/env';
import { requireRole } from '@/modules/auth/session';

const BUCKET = 'quotation-archives';

/**
 * 25 MB a file. Larger than the floor-plan limit because a studio's quotation
 * workbook with a few hundred rows and an embedded logo per sheet runs big,
 * and a studio who is doing us a favour should not have to compress it first.
 */
const MAX_BYTES = 25 * 1024 * 1024;

/** One batch. Enough for a real archive, small enough to bound a request. */
export const MAX_FILES_PER_UPLOAD = 40;

const SIGNED_URL_SECONDS = 300;

/**
 * What a studio may send.
 *
 * Wide on purpose — the instruction is "send whatever you have", and a studio
 * that gets "unsupported file type" on its own quotation gives up rather than
 * converting it. A person opens these, so anything a person can open is fine.
 *
 * `application/octet-stream` is here because Windows sends it for .xlsm often
 * enough that excluding it would reject exactly the format the existing
 * archive is in.
 */
const ALLOWED = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.ms-excel.sheet.macroEnabled.12', 'xlsm'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/msword', 'doc'],
  ['text/csv', 'csv'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['application/zip', 'zip'],
  ['application/octet-stream', 'bin'],
]);

function secretKey(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  return key ? key : null;
}

/** Is sending an archive available on this deployment? */
export function quotationUploadEnabled(): boolean {
  return Boolean(secretKey()) && supabaseConfig() !== null;
}

export interface StoredFile {
  path: string;
  filename: string;
  contentType: string;
  bytes: number;
}

export type StoreResult = { ok: true; file: StoredFile } | { ok: false; error: string };

/**
 * Put one file in the bucket.
 *
 * Returns rather than throws on every failure, because the caller is uploading
 * a batch and one unreadable file out of thirty should not lose the other
 * twenty-nine.
 */
export async function storeQuotationFile(studioId: string, file: File): Promise<StoreResult> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) {
    return { ok: false, error: 'Sending files is not switched on for this deployment.' };
  }

  const extension = ALLOWED.get(file.type) ?? extensionOf(file.name);
  if (!extension) {
    return { ok: false, error: `${safeDisplayName(file.name)} — we cannot take that kind of file.` };
  }
  if (file.size === 0) {
    return { ok: false, error: `${safeDisplayName(file.name)} is empty.` };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `${safeDisplayName(file.name)} is over 25 MB.` };
  }

  // Ours, generated, and never built from what they called the file.
  const path = `studio_${studioId}/${crypto.randomUUID()}.${extension}`;

  try {
    const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'false',
      },
      body: await file.arrayBuffer(),
    });

    if (!response.ok) {
      // Never surface the storage response — it names the bucket and the path
      // layout.
      return { ok: false, error: `We could not store ${safeDisplayName(file.name)}.` };
    }
  } catch {
    return { ok: false, error: 'We could not reach storage. Try again in a minute.' };
  }

  return {
    ok: true,
    file: {
      path,
      filename: safeDisplayName(file.name),
      contentType: file.type || 'application/octet-stream',
      bytes: file.size,
    },
  };
}

/**
 * A short-lived link to one stored quotation file. **Ops only.**
 *
 * The role check is here rather than at the call site because this function is
 * the only way a byte of this bucket is ever read, which makes it the access
 * boundary for the whole feature. A future page that forgets to check gets a
 * throw from `requireRole`, not a leak.
 */
export async function signedUrlForFile(path: string): Promise<string | null> {
  await requireRole('OPS');

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

/**
 * Remove objects from the bucket.
 *
 * Deleting the database rows does NOT do this — a foreign key cannot reach
 * into object storage — so anything that deletes an archive has to call this
 * as well. Best-effort: a stranded object costs a few kilobytes, while a
 * failed delete that took the database rows with it would leave files nobody
 * can find and nobody can remove.
 */
export async function deleteQuotationFiles(paths: string[]): Promise<void> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key || paths.length === 0) return;

  try {
    await fetch(`${config.url}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: paths }),
    });
  } catch {
    /* Tidiness, not correctness. */
  }
}

/** Last resort when the browser sends no useful content type. */
function extensionOf(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : null;
}

/**
 * A display name that cannot be mistaken for a path.
 *
 * This is shown back to the studio — "Kharadi-3BHK-final.xlsx" is how they
 * recognise the file we could not read — and it is user input rendered in a
 * page, so separators and control characters come out first.
 */
function safeDisplayName(original: string): string {
  const cleaned = original
    .replace(/[\\/]/g, '')
    .replace(/[ -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || 'quotation';
}
