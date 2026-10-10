import 'server-only';

/**
 * A customer's project documents — the agreement, the signed quote, drawings,
 * payment receipts, warranties (docs/CUSTOMER-PLATFORM-PLAN.md, step 2).
 *
 * Private, like site photos: the bucket `project-docs` is created private in
 * Supabase, nothing in it has a public URL, and a file is opened only through
 * a signed link that lasts minutes, made for a page the caller has already
 * authorised (the customer's own project, the studio's, ops).
 */

import { supabaseConfig } from '@/lib/env';

const BUCKET = 'project-docs';
/** The server-action body limit (next.config.ts) is 4 MB; the file must fit inside it. */
export const MAX_DOC_BYTES = 3.8 * 1024 * 1024;
const SIGNED_URL_SECONDS = 10 * 60;

const ALLOWED = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export const ACCEPTED_DOCS = 'PDF, JPG, PNG or WebP';

const secretKey = () => process.env.SUPABASE_SECRET_KEY?.trim() || null;

export type DocResult = { ok: true; path: string } | { ok: false; error: string };

export async function storeProjectDoc(projectId: string, file: File): Promise<DocResult> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return { ok: false, error: 'Documents are not switched on for this deployment yet.' };
  const extension = ALLOWED.get(file.type);
  if (!extension) return { ok: false, error: `We can take ${ACCEPTED_DOCS}.` };
  if (file.size === 0) return { ok: false, error: 'That file is empty.' };
  if (file.size > MAX_DOC_BYTES) return { ok: false, error: 'Files can be up to 3.8 MB for now. Split a large drawing set into parts.' };

  const path = `project_${projectId}/${crypto.randomUUID()}.${extension}`;
  try {
    const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': file.type, 'x-upsert': 'false' },
      body: await file.arrayBuffer(),
    });
    if (!response.ok) return { ok: false, error: 'We could not store that file. Try again.' };
  } catch {
    return { ok: false, error: 'We could not reach storage. Try again in a minute.' };
  }
  return { ok: true, path };
}

/** Signed links, in order, for paths the caller has already authorised; "" where one could not be made. */
export async function signedDocUrls(paths: string[]): Promise<string[]> {
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key || paths.length === 0) return paths.map(() => '');
  try {
    const response = await fetch(`${config.url}/storage/v1/object/sign/${BUCKET}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS, paths }),
    });
    if (!response.ok) return paths.map(() => '');
    const json = (await response.json()) as { signedURL?: string | null; signedUrl?: string | null }[];
    return paths.map((_, i) => {
      const u = json[i]?.signedURL ?? json[i]?.signedUrl;
      return u ? `${config.url}/storage/v1${u}` : '';
    });
  } catch {
    return paths.map(() => '');
  }
}
