import 'server-only';

/**
 * Storage for the documents a studio sends to prove it is a real business.
 *
 * ## Why this is its own bucket rather than a folder in the archive one
 *
 * These are identity documents — a GST certificate carries the legal name,
 * the registered address and the proprietor's PAN-derived number. The
 * quotation archive is commercially sensitive; this is personally
 * identifiable, and the two have different retention obligations under DPDP.
 * A shared bucket means one access mistake exposes both, and it means an
 * erasure request has to reason about which objects in a folder were which.
 *
 * ## The posture, which is the same as the archive's
 *
 *  - Private bucket. No public URL, ever.
 *  - Reading is ops-only, through `signedUrlForProof`, which checks the role
 *    itself rather than trusting the caller. Five minutes.
 *  - Object names are ours and generated: `studio_<id>/<uuid>.<ext>`, never
 *    built from what the studio called the file. A name arriving from outside
 *    must not be able to steer a write into another studio's folder.
 *
 * ## Why the studio cannot download its own certificate back
 *
 * Same reasoning as the archive, and it surprises people the same way: an
 * account takeover should not yield a copy of the owner's identity documents.
 * They already have these files — they sent them. What they get back is the
 * filename and the state, which is enough to know what we hold.
 *
 * ## Degrading
 *
 * With no secret key configured, upload is off and the section says so
 * plainly rather than offering a control that cannot work. A missing
 * environment variable removes a feature; it does not break a page.
 */

import { supabaseConfig } from '@/lib/env';
import { requireRole } from '@/modules/auth/session';

const BUCKET = 'business-proof';

/**
 * 10 MB. Smaller than the archive's 25, because these are single certificates
 * — a one-page PDF or a phone photograph of one. A file much larger than this
 * is usually a scan at a resolution nobody needs, and the limit is stated on
 * the control rather than discovered by waiting for an upload to fail.
 */
const MAX_BYTES = 10 * 1024 * 1024;

const SIGNED_URL_SECONDS = 300;

/**
 * Deliberately narrower than the archive's list.
 *
 * "Send whatever you have" is right for a back catalogue and wrong for a
 * certificate: there is one document, the studio knows which one, and a
 * spreadsheet or a zip arriving here means something has been misunderstood.
 * Accepting it would store a file ops then has to write back about.
 */
const ALLOWED = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/heic', 'heic'],
  ['image/webp', 'webp'],
]);

/** For the hint under the control. Kept next to ALLOWED so they cannot drift. */
export const ACCEPTED_PROOF = 'PDF, JPG, PNG';
export const MAX_PROOF_MB = MAX_BYTES / 1024 / 1024;

function secretKey(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  return key ? key : null;
}

/** Is sending a document available on this deployment? */
export function proofUploadEnabled(): boolean {
  return Boolean(secretKey()) && supabaseConfig() !== null;
}

export interface StoredProof {
  path: string;
  filename: string;
  contentType: string;
  bytes: number;
}

export type ProofResult = { ok: true; file: StoredProof } | { ok: false; error: string };

/**
 * Put one document in the bucket.
 *
 * Returns rather than throws, so the form can say what was wrong with the
 * file instead of showing somebody a server error for choosing a .docx.
 */
export async function storeBusinessProof(studioId: string, file: File): Promise<ProofResult> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) {
    return { ok: false, error: 'Sending documents is not switched on for this deployment yet.' };
  }

  const extension = ALLOWED.get(file.type);
  if (!extension) {
    return {
      ok: false,
      error: `We can take ${ACCEPTED_PROOF}. ${safeDisplayName(file.name)} is something else — a photograph of the certificate is fine if you do not have the PDF.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, error: `${safeDisplayName(file.name)} is empty.` };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `${safeDisplayName(file.name)} is over ${MAX_PROOF_MB} MB. A photograph taken on a phone is usually well under it.`,
    };
  }

  const path = `studio_${studioId}/${crypto.randomUUID()}.${extension}`;

  try {
    const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': file.type,
        // Never overwrite. The path carries a fresh uuid, so an upsert could
        // only ever mean a collision we would rather hear about.
        'x-upsert': 'false',
      },
      body: await file.arrayBuffer(),
    });

    if (!response.ok) {
      // Never surfaced: the storage response names the bucket and the path
      // layout, and this message goes on a public-facing screen.
      return { ok: false, error: `We could not store ${safeDisplayName(file.name)}. Try again.` };
    }
  } catch {
    return { ok: false, error: 'We could not reach storage. Try again in a minute.' };
  }

  return {
    ok: true,
    file: {
      path,
      filename: safeDisplayName(file.name),
      contentType: file.type,
      bytes: file.size,
    },
  };
}

/**
 * A short-lived link to one stored document. **Ops only.**
 *
 * The role check lives here rather than at the call site because this is the
 * only way a byte of this bucket is read, which makes it the access boundary
 * for the whole feature. A page added later that forgets to check gets a
 * throw, not a leak.
 */
export async function signedUrlForProof(path: string): Promise<string | null> {
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
 * Remove an object from the bucket.
 *
 * Soft-deleting the row does NOT do this — a database column cannot reach
 * into object storage — so anything that withdraws a document has to call
 * this too. Best effort: a stranded object costs a few kilobytes, while a
 * failed delete that took the row with it would leave a file nobody can
 * account for.
 */
export async function removeBusinessProof(path: string): Promise<void> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return;

  try {
    await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
  } catch {
    /* Logged nowhere on purpose: the path names the studio. */
  }
}

/**
 * A filename safe to print back on a page.
 *
 * It is attacker-supplied text that gets rendered next to our own copy, so
 * the directory separators come out (a name is not a path) and the length is
 * bounded. React escapes it; this is about it not *looking* like one of our
 * strings.
 */
function safeDisplayName(name: string): string {
  return name.replace(/[/\\]/g, '_').slice(0, 120) || 'the file';
}
