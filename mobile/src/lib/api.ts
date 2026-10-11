import { apiBase } from './config';
import { readToken } from './token';
import { sampleCall, SAMPLE } from './sample';
import type { GeioReply, GeioTurn, Notice, Profile, Project } from './types';

/**
 * The only place the app talks to the backend (src/app/api/app/v1 on the
 * website). Every call resolves — never throws — to either the body or a
 * sentence the screen can show as it is.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const OFFLINE = 'We could not reach One Interiors. Check your connection and try again.';

/** Exported for the per-area clients in lib/journey/*.ts; screens use those or `api`, never this directly. */
export async function call<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  // The test build's sample customer: every screen, no server (SAMPLE-DATA.md).
  if (SAMPLE) return sampleCall<T>(method, path, body);
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
  me: () => call<{ user: Me } & Partial<Profile>>('GET', '/me'),
  /** Who, plus their home, coins, expert and unread count. Older servers send only `user`. */
  profile: () => call<{ user: Me } & Partial<Profile>>('GET', '/me'),
  setLocale: (locale: 'en' | 'hi' | 'mr') => call<object>('PATCH', '/me', { locale }),
  /** Asks for Assured (registers interest; our team confirms the fee before anything is charged). */
  requestAssured: () => call<{ assuredRequested: boolean }>('POST', '/plan', { plan: 'assured' }),
  /** Deletes the account (store requirement). The session ends with it. */
  deleteAccount: () => call<object>('DELETE', '/me'),
  geio: (question: string, history: GeioTurn[], lang: 'en' | 'hi' | 'mr', image?: string) =>
    call<{ reply: GeioReply }>('POST', '/geio', { question, history, lang, ...(image ? { image } : {}) }),
  projects: () => call<{ projects: Project[] }>('GET', '/project'),
  choose: (decisionId: string, index: number) => call<object>('POST', `/decisions/${encodeURIComponent(decisionId)}`, { index }),
  /** Phase 5: picks by option id; the server changes the quote, the final payment and the locker. `message` says if the plan moved for a late pick. */
  pick: (decisionId: string, optionId: string) => call<{ message?: string | null }>('POST', `/decisions/${encodeURIComponent(decisionId)}`, { optionId }),
  /** A family member's vote; the owner's pick decides. */
  vote: (decisionId: string, optionId: string) => call<object>('POST', `/decisions/${encodeURIComponent(decisionId)}/vote`, { optionId }),
  /** "Yes, I paid this." */
  confirmPayment: (paymentId: string) => call<object>('POST', `/payments/${encodeURIComponent(paymentId)}/confirm`),
  /** "I didn't pay this": goes to One Interiors' team, with the customer's words. */
  disputePayment: (paymentId: string, note: string) => call<object>('POST', `/payments/${encodeURIComponent(paymentId)}/dispute`, { note }),
  /** Multipart: projectId, title, room?, photos. */
  raiseSnag: (form: FormData) => call<{ id: string }>('POST', '/snags', form),
  /** The studio's fix looks right (or the customer agrees with its reason): the snag closes. Owner only. */
  confirmSnag: (snagId: string) => call<{ id: string }>('POST', `/snags/${encodeURIComponent(snagId)}/confirm`),
  /** The fix did not work: the snag goes back to the studio, with an optional line. Owner only. */
  snagNotFixed: (snagId: string, reason: string) => call<{ id: string }>('POST', `/snags/${encodeURIComponent(snagId)}/not-fixed`, { reason }),
  registerDevice: (token: string, platform: 'ios' | 'android') => call<object>('POST', '/devices', { token, platform }),
  removeDevice: (token: string) => call<object>('DELETE', '/devices', { token }),
  notifications: () => call<{ unread: number; notifications: Notice[] }>('GET', '/notifications'),
  /** Opening the day's site update earns its Home Coins (once a day). */
  openedUpdate: () => call<{ earned: number }>('POST', '/coins/opened'),
  markRead: (ids: string[] | 'all') => call<object>('POST', '/notifications', ids === 'all' ? { all: true } : { ids }),
};
