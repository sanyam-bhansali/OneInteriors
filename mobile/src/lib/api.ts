import { apiBase } from './config';
import { readToken } from './token';

/**
 * The only place the app talks to the backend (src/app/api/app/v1 on the
 * website). Every call resolves — never throws — to either the body or a
 * sentence the screen can show as it is.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const OFFLINE = 'We could not reach One Interiors. Check your connection and try again.';

async function call<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  const token = await readToken();
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api/app/v1${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
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
};
