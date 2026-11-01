'use client';

/**
 * One conversation, as on WhatsApp (owner, 1 Nov 2026; modules/chat): the
 * messages with names, times and read ticks; replying to one message; photos
 * from the camera or gallery, PDFs, and voice notes held to record; taking a
 * message back within the hour. New messages arrive by asking the server
 * every three seconds while the screen is open and visible, and a sent
 * message shows at once, before the server has answered.
 *
 * The same screen for a client (the project app) and the studio (its
 * Chats page): only the frame around it differs. The studio can turn a
 * client's message into a snag or a decision (`asStudio`), and anyone can
 * archive the conversation for themselves.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { listen, type LiveChannel } from './live-socket';
import './chat.css';

export interface Msg {
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
  /** Shown before the server answered. */
  pending?: boolean;
  failed?: string;
}

interface ThreadBody {
  title: string;
  people: { name: string; role: string }[];
  messages: Msg[];
  cursor: string | null;
  live?: LiveChannel | null;
}

const POLL_MS = 3000;
/** With Realtime connected, the check every few seconds becomes a slow safety net. */
const LIVE_POLL_MS = 20_000;
const API = '/api/app/v1/chats';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const day = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const key = (x: Date) => x.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  if (key(d) === key(today)) return 'Today';
  const y = new Date(today.getTime() - 86_400_000);
  if (key(d) === key(y)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
};
const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function ChatRoom({ projectId, kind, back, onBack, asStudio = false }: { projectId: string; kind: string; back?: string; onBack?: () => void; asStudio?: boolean }) {
  const path = `${API}/${encodeURIComponent(projectId)}/${kind.toLowerCase()}`;
  const [thread, setThread] = useState<ThreadBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Msg | null>(null);
  const [recording, setRecording] = useState<{ started: number } | null>(null);
  const cursor = useRef<string | null>(null);
  const connected = useRef(false);
  const lastPoll = useRef(0);
  const [live, setLive] = useState<LiveChannel | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [, tick] = useState(0);
  const [note, setNote] = useState<{ text: string; href?: string } | null>(null);

  const toBottom = () => requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));

  const load = useCallback(async () => {
    const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as (ThreadBody & { ok?: boolean; error?: string }) | null;
    if (!res?.ok || !body) return setError(body?.error ?? 'We could not open this conversation. Check your connection.');
    cursor.current = body.cursor;
    setThread(body);
    setLive(body.live ?? null);
    toBottom();
  }, [path]);

  /** New messages since the last we have, and fresh ticks on the ones on screen. */
  const poll = useCallback(async (now = false) => {
    if (document.visibilityState !== 'visible') return;
    if (!now && connected.current && Date.now() - lastPoll.current < LIVE_POLL_MS) return;
    lastPoll.current = Date.now();
    const since = cursor.current;
    const res = await fetch(since ? `${path}?since=${encodeURIComponent(since)}` : path, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as ThreadBody | null;
    if (!res?.ok || !body) return;
    if (!since) {
      cursor.current = body.cursor;
      setThread(body);
      return;
    }
    if (body.messages.length) {
      cursor.current = body.cursor;
      setThread((t) => {
        if (!t) return t;
        const known = new Set(t.messages.filter((m) => !m.pending).map((m) => m.id));
        const fresh = body.messages.filter((m) => !known.has(m.id));
        /* My own sent message comes back from the server: it replaces its stand-in. */
        const kept = t.messages.filter((m) => !m.pending || !fresh.some((f) => f.mine && f.body === m.body && f.kind === m.kind));
        return { ...t, messages: [...kept, ...fresh] };
      });
      toBottom();
    }
  }, [path]);

  /* Realtime: a ping means something new; fetch it now. */
  useEffect(() => {
    if (!live) return;
    return listen(
      live,
      () => void poll(true),
      (on) => {
        connected.current = on;
      },
    );
  }, [live, poll]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void poll(), POLL_MS);
    const onShow = () => document.visibilityState === 'visible' && void poll(true);
    document.addEventListener('visibilitychange', onShow);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [load, poll]);

  /* Recompute the "send" ticks' clock while recording. */
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [recording]);

  async function send(input: { body: string; file?: File; durationMs?: number }) {
    const kind: Msg['kind'] = input.file ? (input.file.type.startsWith('image/') ? 'PHOTO' : input.file.type.startsWith('audio/') ? 'VOICE' : 'FILE') : 'TEXT';
    const stand: Msg = {
      id: `pending-${Date.now()}`,
      from: 'You',
      role: '',
      side: '',
      mine: true,
      kind,
      body: input.body,
      url: input.file && kind === 'PHOTO' ? URL.createObjectURL(input.file) : null,
      fileName: input.file?.name ?? null,
      durationMs: input.durationMs ?? null,
      replyTo: reply ? { id: reply.id, from: reply.from, preview: reply.body || reply.kind.toLowerCase() } : null,
      at: new Date().toISOString(),
      tick: 'sent',
      taken: false,
      canTakeBack: false,
      pending: true,
    };
    setThread((t) => (t ? { ...t, messages: [...t.messages, stand] } : t));
    setReply(null);
    toBottom();
    let res: Response | null;
    if (input.file) {
      const form = new FormData();
      form.set('body', input.body);
      form.set('file', input.file);
      if (input.durationMs) form.set('durationMs', String(input.durationMs));
      if (stand.replyTo) form.set('replyToId', stand.replyTo.id);
      res = await fetch(path, { method: 'POST', credentials: 'same-origin', body: form }).catch(() => null);
    } else {
      res = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: input.body, replyToId: stand.replyTo?.id }),
      }).catch(() => null);
    }
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as { error?: string } | null;
      setThread((t) => (t ? { ...t, messages: t.messages.map((m) => (m.id === stand.id ? { ...m, failed: body?.error ?? 'Not sent. Check your connection.' } : m)) } : t));
      return;
    }
    void poll(true);
  }

  function submit() {
    const body = text.trim();
    if (!body) return;
    setText('');
    void send({ body });
  }

  async function startVoice() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.start();
      recorder.current = rec;
      setRecording({ started: Date.now() });
    } catch {
      setError('The microphone is off for this site. Allow it in your browser, then hold the button again.');
    }
  }

  function stopVoice(cancel = false) {
    const rec = recorder.current;
    if (!rec || !recording) return;
    const ms = Date.now() - recording.started;
    rec.onstop = () => {
      rec.stream.getTracks().forEach((t) => t.stop());
      if (cancel || ms < 800) return;
      const type = (rec.mimeType || 'audio/webm').split(';')[0]!;
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      void send({ body: '', file: new File(chunks.current, `voice.${ext}`, { type }), durationMs: ms });
    };
    rec.stop();
    recorder.current = null;
    setRecording(null);
  }

  async function makeSnag(m: Msg) {
    const res = await fetch(`${API}/messages/${encodeURIComponent(m.id)}/snag`, { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string; projectId?: string } | null;
    setNote(res?.ok ? { text: 'Added as a snag. The client sees it in Snags.', href: `/studio/projects/${projectId}?tab=snags` } : { text: body?.error ?? 'That did not go through.' });
  }

  async function archive() {
    const res = await fetch(`${path}/archive`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archive: true }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    setNote(res?.ok ? { text: 'Archived. It comes back by itself with the next message.' } : { text: body?.error ?? 'That did not go through.' });
  }

  async function takeBack(m: Msg) {
    const res = await fetch(`${API}/messages/${encodeURIComponent(m.id)}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => null);
    if (res?.ok) setThread((t) => (t ? { ...t, messages: t.messages.map((x) => (x.id === m.id ? { ...x, taken: true, body: '', url: null, canTakeBack: false } : x)) } : t));
  }

  if (error && !thread) return <p className="chat-error">{error}</p>;
  if (!thread) return <p className="chat-empty">Opening…</p>;

  let lastDay = '';
  return (
    <section className="chat-room" aria-label={thread.title}>
      <header className="chat-head">
        {onBack || back ? (
          <a
            href={back ?? '#'}
            onClick={(e) => {
              if (onBack) {
                e.preventDefault();
                onBack();
              }
            }}
            className="chat-back"
            aria-label="Back"
          >
            ‹
          </a>
        ) : null}
        <div>
          <b>{thread.title}</b>
          <span>{thread.people.map((p) => `${p.name} · ${p.role}`).join(', ') || 'Your phone number stays private'}</span>
        </div>
        {thread.messages.length ? (
          <button type="button" className="chat-archive" onClick={() => void archive()}>
            Archive
          </button>
        ) : null}
      </header>
      {note ? (
        <p className="chat-notice" role="status">
          {note.text}{' '}
          {note.href ? <a href={note.href}>Open</a> : null}
        </p>
      ) : null}

      <div className="chat-list" ref={listRef}>
        {thread.messages.length === 0 ? <p className="chat-empty">No messages yet. Say hello; everyone in this conversation sees it.</p> : null}
        {thread.messages.map((m) => {
          const d = day(m.at);
          const showDay = d !== lastDay;
          lastDay = d;
          return (
            <div key={m.id}>
              {showDay ? <p className="chat-day">{d}</p> : null}
              <div className={`chat-msg${m.mine ? ' mine' : ''}${m.failed ? ' failed' : ''}`}>
                {!m.mine ? (
                  <span className="chat-from">
                    {m.from}
                    {m.role ? ` · ${m.role}` : ''}
                  </span>
                ) : null}
                {m.replyTo ? (
                  <span className="chat-quote">
                    <b>{m.replyTo.from}</b> {m.replyTo.preview}
                  </span>
                ) : null}
                {m.taken ? (
                  <i className="chat-taken">Message taken back</i>
                ) : (
                  <>
                    {m.kind === 'PHOTO' && m.url ? (
                      <a href={m.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.url} alt={m.body || 'Photo'} className="chat-photo" />
                      </a>
                    ) : null}
                    {m.kind === 'VOICE' ? (
                      m.url ? (
                        <audio controls preload="none" src={m.url} className="chat-audio" />
                      ) : (
                        <span className="chat-note">Voice note {m.durationMs ? clock(m.durationMs) : ''}</span>
                      )
                    ) : null}
                    {m.kind === 'FILE' ? (
                      <a href={m.url ?? '#'} target="_blank" rel="noreferrer" className="chat-file">
                        PDF · {m.fileName ?? 'file'}
                      </a>
                    ) : null}
                    {m.body ? <p className="chat-body">{m.body}</p> : null}
                  </>
                )}
                <span className="chat-meta">
                  {time(m.at)}
                  {m.mine ? (
                    <span
                      className={`chat-tick ${m.pending ? 'wait' : (m.tick ?? '')}`}
                      aria-label={m.pending ? 'Sending' : m.tick === 'read' ? 'Read' : m.tick === 'delivered' ? 'Delivered' : 'Sent'}
                    />
                  ) : null}
                </span>
                {m.failed ? <span className="chat-failed">{m.failed}</span> : null}
                {!m.taken && !m.pending ? (
                  <span className="chat-actions">
                    <button type="button" onClick={() => setReply(m)}>
                      Reply
                    </button>
                    {m.canTakeBack ? (
                      <button type="button" onClick={() => void takeBack(m)}>
                        Take back
                      </button>
                    ) : null}
                    {asStudio && !m.mine && (m.side === 'CLIENT' || m.side === 'FAMILY') ? (
                      <>
                        <button type="button" onClick={() => void makeSnag(m)}>
                          Make a snag
                        </button>
                        <a href={`/studio/projects/${encodeURIComponent(projectId)}/decisions/new?title=${encodeURIComponent((m.body || '').slice(0, 80))}`}>Make a decision</a>
                      </>
                    ) : null}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {error ? <p className="chat-error">{error}</p> : null}
      {reply ? (
        <div className="chat-replying">
          <span>
            Replying to <b>{reply.from}</b>: {reply.body.slice(0, 80) || reply.kind.toLowerCase()}
          </span>
          <button type="button" onClick={() => setReply(null)} aria-label="Cancel reply">
            ×
          </button>
        </div>
      ) : null}
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className="chat-icon" onClick={() => fileRef.current?.click()} aria-label="Add a photo or PDF">
          +
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void send({ body: text.trim(), file: f }).then(() => setText(''));
          }}
        />
        {recording ? (
          <span className="chat-recording">Recording {clock(Date.now() - recording.started)} · release to send</span>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Message"
            aria-label="Message"
          />
        )}
        {text.trim() ? (
          <button type="submit" className="chat-send" aria-label="Send">
            ➤
          </button>
        ) : (
          <button
            type="button"
            className={`chat-send${recording ? ' rec' : ''}`}
            aria-label="Hold to record a voice note"
            onPointerDown={() => void startVoice()}
            onPointerUp={() => stopVoice()}
            onPointerLeave={() => stopVoice(true)}
          >
            🎙
          </button>
        )}
      </form>
    </section>
  );
}
