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

import { isProduction, supabaseConfig } from '@/lib/env';
import { siteUrlFor } from '@/lib/site';
import { generatedDocLink } from '@/modules/portal/documents';

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

/**
 * Links, in order, for documents the caller has already authorised: a signed
 * storage link for an uploaded file, the page for one filed at signing
 * (portal/documents.ts `generatedDocLink`); "" where one could not be made.
 */
export async function signedDocUrls(keys: string[]): Promise<string[]> {
  const origin = siteUrlFor('public');
  const filed = keys.map((k) => generatedDocLink(k, origin));
  const stored = keys.filter((_, i) => filed[i] === null);
  const signed = await signedStorageUrls(stored);
  let next = 0;
  return filed.map((link) => link ?? signed[next++] ?? '');
}

async function signedStorageUrls(paths: string[]): Promise<string[]> {
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

// ── Large files straight from the browser (DESIGN-PROCESS-PLAN.md §3.6) ──

/** Storage is not set up on this machine and it is not production: a path is handed out, nothing is stored (local development). */
const unstored = () => !(secretKey() && supabaseConfig()) && !isProduction();

export type DocTicket = { ok: true; path: string; url: string | null } | { ok: false; error: string };

/**
 * A one-time URL the browser PUTs one project file to (up to 50 MB: the
 * bucket's own size limit must allow it), so a drawing set or a SketchUp
 * model never passes through a server function. `url: null` in local
 * development with no storage. The caller has already checked who may upload
 * to this project, and the file's type and size (studio-design/documents.ts
 * `checkUpload`).
 */
export async function projectDocTicket(projectId: string, ext: string): Promise<DocTicket> {
  const path = `project_${projectId}/${crypto.randomUUID()}.${ext}`;
  if (unstored()) return { ok: true, path: `dev-unstored/${path}`, url: null };
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return { ok: false, error: 'Documents are not switched on for this deployment yet.' };
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

/** Is a path this project's own upload? (A path from a browser proves nothing until checked.) */
export const docPathBelongsTo = (path: unknown, projectId: string): path is string =>
  typeof path === 'string' && (path.startsWith(`project_${projectId}/`) || path.startsWith(`dev-unstored/project_${projectId}/`)) && !path.includes('..') && path.length < 200;

/** Whether a finished upload is really in the bucket. */
export async function projectDocExists(path: string): Promise<boolean> {
  if (path.startsWith('dev-unstored/')) return unstored();
  const config = supabaseConfig();
  const key = secretKey();
  if (!config || !key) return false;
  try {
    const res = await fetch(`${config.url}/storage/v1/object/info/${BUCKET}/${encodeURI(path)}`, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Signed links that download under a name we made (TYPE_Studio_Client_…,
 * studio-design/documents.ts `docFileName`), in order; "" where one could not
 * be made, or for a local file that was never stored.
 */
export async function signedDocDownloads(items: readonly { key: string; name: string }[]): Promise<string[]> {
  const real = items.map((i, k) => ({ ...i, k })).filter((i) => i.key && !i.key.startsWith('dev-unstored/'));
  const urls = real.length ? await signedDocUrls(real.map((i) => i.key)) : [];
  const out = items.map(() => '');
  real.forEach((i, n) => {
    const u = urls[n] ?? '';
    out[i.k] = u && u.includes('/storage/v1/') ? `${u}${u.includes('?') ? '&' : '?'}download=${encodeURIComponent(i.name)}` : u;
  });
  return out;
}
