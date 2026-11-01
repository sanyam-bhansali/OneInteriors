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

/** Who to call about the home until chat is built (GET /contacts): the designer first. */
export interface Contact {
  name: string;
  role: 'Designer' | 'Project manager';
  phone: string | null;
}

/** One room of the client's mood board (GET /moodboard, 1 Nov 2026). */
/** The requirement form (1 Nov 2026; the server's project/requirement-form.ts): its questions come from the server. */
export interface FormQuestion {
  id: string;
  label: string;
  kind: 'text' | 'long' | 'choice';
  options?: string[];
  help?: string;
  required: boolean;
  commitment?: boolean;
}
export interface RequirementForm {
  projectId: string;
  studio: string;
  title: string;
  intro: string;
  state: 'sent' | 'filled';
  filledOn: string | null;
  sections: { id: string; title: string; questions: FormQuestion[] }[];
  answers: Record<string, string>;
}
export interface MoodRoom {
  key: string;
  label: string;
  style: string;
  materials: string[];
  optionCount: number;
  shuffle: number;
  question: string;
  options: { label: string; note: string }[];
  chosenOption: number | null;
  note: string;
  items: { slug: string; label: string }[];
  picker: { slug: string; label: string; aboveBand: boolean }[];
}

/** A quotation to read and sign in the app (GET /signoffs/:id, 1 Nov 2026). */
export interface SignoffView {
  id: string;
  kind: 'SALES_FINAL' | 'DESIGN_FINAL' | 'AGREEMENT';
  kindLabel: string;
  quoteNumber: string;
  revision: number;
  state: string;
  canSign: boolean;
  viewer: 'owner' | 'family' | 'studio';
  hash: string;
  changedSince: boolean;
  signed: { name: string; on: string; line: string } | null;
  agreeText: string;
  studio: string | null;
  lines: { room: string; product: string; details: string | null; note: string | null; amountPaise: number }[];
  totals: { workPaise: number; feePaise: number; discountPaise: number; gstPaise: number; totalPaise: number };
  stages: { label: string; amountPaise: number }[];
  terms: string | null;
}

/** In-app chat (owner, 1 Nov 2026; the website's modules/chat). */
export type ChatKind = 'DESIGNER' | 'TEAM' | 'ONE_INTERIORS';
export interface ChatRow {
  projectId: string;
  kind: ChatKind;
  title: string;
  home: string;
  studio: string;
  last: { preview: string; at: string; from: string; mine: boolean } | null;
  unread: number;
  archived?: boolean;
}
export interface ChatHit {
  projectId: string;
  kind: ChatKind;
  title: string;
  home: string;
  from: string;
  preview: string;
  at: string;
}
export interface ChatMsg {
  id: string;
  from: string;
  role: string;
  side: string;
  mine: boolean;
  kind: 'TEXT' | 'PHOTO' | 'VOICE' | 'FILE';
  body: string;
  url: string | null;
  fileName: string | null;
  durationMs: number | null;
  replyTo: { id: string; from: string; preview: string } | null;
  at: string;
  tick: 'sent' | 'delivered' | 'read' | null;
  taken: boolean;
  canTakeBack: boolean;
  pending?: boolean;
  failed?: string;
}
export interface ChatThread {
  projectId: string;
  kind: ChatKind;
  title: string;
  studio: string;
  people: { name: string; role: string }[];
  messages: ChatMsg[];
  cursor: string | null;
  /** Where to listen for "something new" (Supabase Realtime); null without it. */
  live?: { socket: string; key: string; topic: string } | null;
}
const chatPath = (projectId: string, kind: ChatKind) => `/chats/${encodeURIComponent(projectId)}/${kind.toLowerCase()}`;

export const api = {
  /** A booked site visit or meeting: "I'll be there", or ask for another day with why (1 Nov 2026). */
  answerVisit: (visitId: string, answer: 'confirm' | 'move', reason?: string) => call<{ message?: string | null }>('POST', `/visits/${encodeURIComponent(visitId)}`, { answer, reason: reason ?? '' }),
  /** "None of these: show me other options" on a decision (1 Nov 2026). */
  askOtherOptions: (decisionId: string, note: string) => call<object>('POST', `/decisions/${encodeURIComponent(decisionId)}/redo`, { note }),
  requirements: () => call<{ form: RequirementForm | null }>('GET', '/requirements'),
  sendRequirements: (answers: Record<string, string>) => call<{ message?: string }>('POST', '/requirements', { answers }),
  moodboard: () => call<{ open: boolean; rooms: MoodRoom[] }>('GET', '/moodboard'),
  saveMoodRoom: (room: string, patch: { shuffle?: number; chosenOption?: number | null; note?: string; items?: string[] }) => call<object>('POST', `/moodboard/${encodeURIComponent(room)}`, patch),
  signoff: (id: string) => call<SignoffView>('GET', `/signoffs/${encodeURIComponent(id)}`),
  signSignoff: (id: string, b: { agreed: boolean; name: string; hash: string }) => call<{ message?: string | null; signedLine?: string | null }>('POST', `/signoffs/${encodeURIComponent(id)}`, b),
  chats: (archived = false) => call<{ chats: ChatRow[]; unread: number }>('GET', archived ? '/chats?archived=1' : '/chats'),
  chatSearch: (q: string) => call<{ hits: ChatHit[] }>('GET', `/chats?q=${encodeURIComponent(q)}`),
  chatArchive: (projectId: string, kind: ChatKind, archive: boolean) => call<{ archived: boolean }>('POST', `${chatPath(projectId, kind)}/archive`, { archive }),
  chatThread: (projectId: string, kind: ChatKind, since?: string | null) =>
    call<ChatThread>('GET', `${chatPath(projectId, kind)}${since ? `?since=${encodeURIComponent(since)}` : ''}`),
  chatSend: (projectId: string, kind: ChatKind, body: string, replyToId?: string | null) => call<{ id: string }>('POST', chatPath(projectId, kind), { body, replyToId }),
  /** Multipart: file ({ uri, name, type }), body, durationMs, replyToId. */
  chatSendFile: (projectId: string, kind: ChatKind, form: FormData) => call<{ id: string }>('POST', chatPath(projectId, kind), form),
  chatTakeBack: (messageId: string) => call<object>('DELETE', `/chats/messages/${encodeURIComponent(messageId)}`),
  /** The clients' sign-in while codes are not live (owner, 1 Nov 2026): mobile number and the studio's password. */
  passwordSignIn: (phone: string, password: string) => call<{ token: string; mustChange: boolean }>('POST', '/auth/password', { phone, password }),
  /** Replace the studio's one-time password with their own. */
  choosePassword: (password: string) => call<object>('POST', '/auth/password/choose', { password }),
  /** "Connect your project": the link or code the designer sent. */
  join: (code: string) => call<{ studio: string }>('POST', '/join', { code }),
  contacts: () => call<{ studio: string | null; contacts: Contact[] }>('GET', '/contacts'),
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
  /** Studio OS Phase 2: approve a shared drawing, or ask for changes with what to change. Owner only. */
  answerDrawing: (documentId: string, verdict: 'APPROVED' | 'CHANGES', comment: string) =>
    call<{ id: string }>('POST', `/design/${encodeURIComponent(documentId)}/answer`, { verdict, comment }),
  /** The project lifecycle: the owner signs off the handover once every snag is closed; the warranty starts. */
  signOffHandover: (projectId: string) => call<{ warrantyEndsOn: string }>('POST', `/project/${encodeURIComponent(projectId)}/handover`, {}),
  /** Change orders (15 Oct 2026): approve extra work, or decline it with a reason. Owner only. */
  answerExtra: (extraId: string, approve: boolean, reason?: string) =>
    call<{ message?: string | null }>('POST', `/extras/${encodeURIComponent(extraId)}`, approve ? { approve: true } : { approve: false, reason: reason ?? '' }),
  registerDevice: (token: string, platform: 'ios' | 'android') => call<object>('POST', '/devices', { token, platform }),
  removeDevice: (token: string) => call<object>('DELETE', '/devices', { token }),
  notifications: () => call<{ unread: number; notifications: Notice[] }>('GET', '/notifications'),
  /** Opening the day's site update earns its Home Coins (once a day). */
  openedUpdate: () => call<{ earned: number }>('POST', '/coins/opened'),
  markRead: (ids: string[] | 'all') => call<object>('POST', '/notifications', ids === 'all' ? { all: true } : { ids }),
};
