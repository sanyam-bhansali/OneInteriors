'use client';

/**
 * The phone's outbox for site posts (studio workspace Phase 2, "Offline").
 *
 * Pressing Post never waits on the network. The post — photos as Blobs,
 * voice notes, crew, ticks, and `postedAt`, the moment Post was pressed — is
 * written to IndexedDB first, and then sent:
 *
 *   1. each photo and voice note not yet uploaded goes up through a signed
 *      upload URL (/api/studio/site/upload), and its storage path is written
 *      back into the saved post at once, so a retry never uploads it twice;
 *   2. the post itself goes to /api/studio/site/post with its `clientRef`.
 *      A resend after a dropped answer lands once (the server finds the
 *      `clientRef`).
 *
 * It is retried when the connection comes back (`online`), when the screen
 * is shown again, every 20 seconds while anything waits, and from "Send
 * now". Status per post: waiting → sending → sent (or failed, for a post the
 * server will never take — kept, with the reason, never thrown away).
 *
 * Without IndexedDB (a private window on an old browser) the post is held in
 * memory and sent the same way; it is lost only if the page is closed
 * before it goes.
 */

export type SpeechLangName = 'en' | 'hi' | 'mr';

export interface QueuedVoice {
  blob?: Blob;
  type?: string;
  path?: string;
  transcript?: string | null;
  transcriptLang?: SpeechLangName | null;
  customerText?: string | null;
  customerLang?: SpeechLangName | null;
}

export interface QueuedPhoto {
  key: string;
  blob?: Blob;
  type: string;
  path?: string;
  takenAt: string;
  fromGallery: boolean;
  lat: number | null;
  lng: number | null;
  voice: QueuedVoice | null;
}

export type QueuedCrew = { crewMemberId: string; arrivedAt: string | null } | { crewMemberId: null; name: string; role: string; arrivedAt: string | null; save: boolean };

export interface QueuedPost {
  clientRef: string;
  projectId: string;
  home: string;
  kind: 'UPDATE' | 'NOBODY';
  reason: string | null;
  postedAt: string;
  photos: QueuedPhoto[];
  voice: QueuedVoice | null;
  crew: QueuedCrew[];
  ticks: { itemId: string; source: 'TICK' | 'VOICE' }[];
  status: 'waiting' | 'sending' | 'sent' | 'failed';
  error: string | null;
  sentAt: string | null;
  /** What the server said it recorded. */
  result: { kind: string; photos: number; crew: number; ticked: number; stage: string | null; customerFirst: string } | null;
}

const DB = 'oi-site';
const STORE = 'posts';
const KEEP_SENT_MS = 2 * 86_400_000;

let memory: QueuedPost[] = [];
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'clientRef' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = run(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function save(post: QueuedPost): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory = [...memory.filter((p) => p.clientRef !== post.clientRef), post];
    return;
  }
  await tx(db, 'readwrite', (s) => s.put(post));
}

async function remove(clientRef: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory = memory.filter((p) => p.clientRef !== clientRef);
    return;
  }
  await tx(db, 'readwrite', (s) => s.delete(clientRef));
}

export async function listPosts(): Promise<QueuedPost[]> {
  const db = await openDb();
  const all = db ? await tx<QueuedPost[]>(db, 'readonly', (s) => s.getAll() as IDBRequest<QueuedPost[]>).catch(() => []) : memory;
  return [...all].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
}

/* ------------------------------------------------------------ listeners */

type Listener = (posts: QueuedPost[]) => void;
const listeners = new Set<Listener>();
const emit = async () => {
  const posts = await listPosts();
  listeners.forEach((l) => l(posts));
};

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  void listPosts().then(l);
  return () => listeners.delete(l);
}

/* -------------------------------------------------------------- sending */

/** A random id for one post; the server's `clientRef`. */
export function newClientRef(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

class Refused extends Error {
  constructor(readonly code: string, readonly retry: boolean) {
    super(code);
  }
}

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok && json.ok) return json;
  const code = typeof json.error === 'string' ? json.error : `http_${res.status}`;
  // Signed out, busy, storage down, server trouble: worth trying again. A post the server will never take: not.
  const retry = res.status >= 500 || res.status === 401 || res.status === 409 || res.status === 429 || code === 'storage';
  throw new Refused(code, retry);
}

/** One file up to storage. Returns its path. */
export async function uploadFile(projectId: string, kind: 'site' | 'voice', blob: Blob, type: string): Promise<string> {
  const ticket = await postJson('/api/studio/site/upload', { projectId, kind, contentType: type });
  const path = String(ticket.path);
  if (typeof ticket.url === 'string') {
    const res = await fetch(ticket.url, { method: 'PUT', headers: { 'content-type': type, 'x-upsert': 'false' }, body: blob });
    if (!res.ok) throw new Refused('storage', true);
  }
  return path;
}

let flushing: Promise<void> | null = null;

/** Send everything waiting. Safe to call any time; one run at a time. */
export function flush(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      const posts = await listPosts();
      const now = Date.now();
      for (const p of posts) {
        if (p.status === 'sent' && p.sentAt && now - Date.parse(p.sentAt) > KEEP_SENT_MS) await remove(p.clientRef);
      }
      for (const p of posts.filter((x) => x.status === 'waiting' || x.status === 'sending').reverse()) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
        await sendOne(p);
      }
    } finally {
      flushing = null;
      await emit();
    }
  })();
  return flushing;
}

async function sendOne(post: QueuedPost): Promise<void> {
  const p: QueuedPost = { ...post, status: 'sending' };
  await save(p);
  await emit();
  try {
    for (const ph of p.photos) {
      if (!ph.path && ph.blob) {
        ph.path = await uploadFile(p.projectId, 'site', ph.blob, ph.type);
        delete ph.blob;
        await save(p);
      }
      if (ph.voice && !ph.voice.path && ph.voice.blob) {
        ph.voice.path = await uploadFile(p.projectId, 'voice', ph.voice.blob, ph.voice.type ?? 'audio/webm');
        delete ph.voice.blob;
        await save(p);
      }
    }
    if (p.voice && !p.voice.path && p.voice.blob) {
      p.voice.path = await uploadFile(p.projectId, 'voice', p.voice.blob, p.voice.type ?? 'audio/webm');
      delete p.voice.blob;
      await save(p);
    }
    const spoken = (v: QueuedVoice | null) =>
      v ? { voicePath: v.path ?? null, transcript: v.transcript ?? null, transcriptLang: v.transcriptLang ?? null, customerText: v.customerText ?? null, customerLang: v.customerLang ?? null } : {};
    const res = await postJson('/api/studio/site/post', {
      projectId: p.projectId,
      clientRef: p.clientRef,
      kind: p.kind,
      reason: p.reason,
      postedAt: p.postedAt,
      photos: p.photos.map((ph) => ({ path: ph.path, takenAt: ph.takenAt, fromGallery: ph.fromGallery, lat: ph.lat, lng: ph.lng, ...spoken(ph.voice) })),
      voice: p.voice ? spoken(p.voice) : null,
      crew: p.crew,
      ticks: p.ticks,
    });
    const r = res.post as QueuedPost['result'];
    await save({ ...p, status: 'sent', error: null, sentAt: new Date().toISOString(), result: r });
  } catch (e) {
    const refused = e instanceof Refused ? e : null;
    // A network failure (fetch threw) is just "no signal yet".
    const retry = refused ? refused.retry : true;
    await save({ ...p, status: retry ? 'waiting' : 'failed', error: refused?.code ?? null });
  }
}

/** Save a post on the phone and start sending it. */
export async function enqueue(post: Omit<QueuedPost, 'status' | 'error' | 'sentAt' | 'result'>): Promise<void> {
  await save({ ...post, status: 'waiting', error: null, sentAt: null, result: null });
  await emit();
  void flush();
}

/** Put a failed post back in line (after signing in again, say). */
export async function retry(clientRef: string): Promise<void> {
  const p = (await listPosts()).find((x) => x.clientRef === clientRef);
  if (p) await save({ ...p, status: 'waiting', error: null });
  await flush();
}

let started = false;

/** Retry on reconnect, when the screen comes back, and every 20 s while anything waits. Once per page. */
export function startOutbox(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flush();
  });
  window.setInterval(() => {
    void listPosts().then((ps) => {
      if (ps.some((p) => p.status === 'waiting')) void flush();
    });
  }, 20_000);
  // A post left "sending" by a closed tab is waiting again.
  void listPosts().then(async (ps) => {
    for (const p of ps) if (p.status === 'sending') await save({ ...p, status: 'waiting' });
    await flush();
  });
}
