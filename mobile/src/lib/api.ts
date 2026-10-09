import { apiBase } from './config';
import { readToken } from './token';
import type { Notice, Project } from './types';

/**
 * The only place the app talks to the backend (src/app/api/app/v1 on the
 * website). Every call resolves — never throws — to either the body or a
 * sentence the screen can show as it is.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const OFFLINE = 'We could not reach One Interiors. Check your connection and try again.';

async function call<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  const token = await readToken();
  const form = typeof FormData !== 'undefined' && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api/app/v1${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body === undefined || form ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : form ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: OFFLINE };
  }

  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !json) {
    return { ok: false, status: res.status, error: json?.error ?? OFFLINE };
  }
  return { ok: true, data: json };
}

export interface Me {
  id: string;
  name: string | null;
  phone: string | null;
}

export const api = {
  requestCode: (phone: string, name: string) =>
    call<{ devCode?: string }>('POST', '/auth/otp/request', { phone, name }),
  verifyCode: (phone: string, code: string, name: string) =>
    call<{ token: string }>('POST', '/auth/otp/verify', { phone, code, name }),
  signOut: () => call<object>('POST', '/auth/sign-out'),
  me: () => call<{ user: Me }>('GET', '/me'),
  projects: () => call<{ projects: Project[] }>('GET', '/project'),
  choose: (decisionId: string, index: number) => call<object>('POST', `/decisions/${encodeURIComponent(decisionId)}`, { index }),
  /** Multipart: projectId, title, room?, photos. */
  raiseSnag: (form: FormData) => call<{ id: string }>('POST', '/snags', form),
  registerDevice: (token: string, platform: 'ios' | 'android') => call<object>('POST', '/devices', { token, platform }),
  removeDevice: (token: string) => call<object>('DELETE', '/devices', { token }),
  notifications: () => call<{ unread: number; notifications: Notice[] }>('GET', '/notifications'),
  /** Opening the day's site update earns its Home Coins (once a day). */
  openedUpdate: () => call<{ earned: number }>('POST', '/coins/opened'),
  markRead: (ids: string[] | 'all') => call<object>('POST', '/notifications', ids === 'all' ? { all: true } : { ids }),
};
