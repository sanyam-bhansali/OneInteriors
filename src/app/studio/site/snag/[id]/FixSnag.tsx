'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { shrinkImage } from '@/lib/shrink-image';
import { hearFixAction, markFixedAction, type Heard } from '../actions';
import type { SnagWordKey } from '../words';

/**
 * *Fix a snag*, on the phone (studio workspace Phase 4). Built for one hand,
 * a weak connection and no typing:
 *
 * 1. **Take the after photo** — opens the camera; shrunk on the phone to
 *    1600 px and uploaded straight to storage (`/api/studio/site/upload`,
 *    the same signed upload the daily update uses). The preview shows at once.
 * 2. **Say what you fixed** — optional. Tap, speak in any language, tap to
 *    stop. Shows what was heard and the sentence the customer will read,
 *    with Redo. The recording is kept for the team; the customer never hears it.
 * 3. **Mark fixed** — disabled until the after photo is saved, and the line
 *    under it says why. It does not close the snag: the customer confirms,
 *    or it closes by itself in seven days.
 *
 * A failed step keeps everything on screen and says "tap again".
 */

type W = Record<SnagWordKey, string>;

export interface FixSnagView {
  id: string;
  projectId: string;
  title: string;
  room: string | null;
  home: string;
  customerFirst: string;
  raisedBy: 'customer' | 'studio';
  raisedNote: string | null;
  raisedOn: string;
  state: 'raised' | 'accepted' | 'disputed' | 'fixed' | 'reopened' | 'closed';
  fixByLabel: string | null;
  overdue: boolean;
  mine: boolean;
  assigneeName: string | null;
  internalNote: string | null;
  notFixedReason: string | null;
  before: string | null;
  after: string | null;
  fixSentence: string | null;
  canFix: boolean;
}

type Photo = { preview: string; file: File; fromGallery: boolean; status: 'saving' | 'saved' | 'failed'; path: string | null };
type Voice =
  | { status: 'idle' }
  | { status: 'recording' }
  | { status: 'hearing' }
  | { status: 'done'; path: string; heard: NonNullable<Heard> }
  | { status: 'off'; path: string }
  | { status: 'failed'; message: string }
  | { status: 'blocked' };

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);

/** A one-time upload URL from site mode's upload route, then the file straight to storage. Null on failure. */
async function upload(projectId: string, kind: 'site' | 'voice', file: Blob): Promise<string | null> {
  try {
    const res = await fetch('/api/studio/site/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, kind, contentType: file.type || (kind === 'site' ? 'image/jpeg' : 'audio/webm') }),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; path?: string; url?: string | null } | null;
    if (!res.ok || !json?.ok || !json.path) return null;
    if (json.url) {
      const put = await fetch(json.url, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
      if (!put.ok) return null;
    }
    return json.path;
  } catch {
    return null;
  }
}

function pickAudioType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return '';
}

const LANG_NAME: Record<string, string> = { en: 'English', hi: 'हिंदी', mr: 'मराठी' };

export function FixSnag({ snag, words: w, lang }: { snag: FixSnagView; words: W; lang: string }) {
  const name = snag.customerFirst;
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [voice, setVoice] = useState<Voice>({ status: 'idle' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(snag.state === 'fixed' || snag.state === 'closed');
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  const savePhoto = async (p: Photo) => {
    setPhoto({ ...p, status: 'saving' });
    const path = await upload(snag.projectId, 'site', p.file);
    setPhoto((cur) => (cur && cur.preview === p.preview ? { ...cur, status: path ? 'saved' : 'failed', path } : cur));
  };

  const onPhoto = async (f: File | undefined, fromGallery: boolean) => {
    if (!f) return;
    setError(null);
    const file = await shrinkImage(f);
    const p: Photo = { preview: URL.createObjectURL(file), file, fromGallery, status: 'saving', path: null };
    await savePhoto(p);
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = pickAudioType();
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: (rec.mimeType || type || 'audio/webm').split(';')[0] });
        void hear(blob);
      };
      recorder.current = rec;
      rec.start();
      setVoice({ status: 'recording' });
    } catch {
      setVoice({ status: 'blocked' });
    }
  };

  const hear = async (blob: Blob) => {
    setVoice({ status: 'hearing' });
    const path = await upload(snag.projectId, 'voice', blob);
    if (!path) return setVoice({ status: 'failed', message: w.failed });
    const r = await hearFixAction(snag.id, path, lang).catch(() => null);
    if (!r) return setVoice({ status: 'failed', message: w.failed });
    if (!r.ok) return setVoice({ status: 'failed', message: r.error });
    setVoice(r.heard ? { status: 'done', path, heard: r.heard } : { status: 'off', path });
  };

  const mic = () => {
    if (voice.status === 'recording') recorder.current?.stop();
    else if (voice.status !== 'hearing') void startRecording();
  };

  const ready = photo?.status === 'saved' && !sent && snag.canFix;
  const markFixed = async () => {
    if (!ready || !photo?.path || sending) return;
    setSending(true);
    setError(null);
    const v =
      voice.status === 'done'
        ? { path: voice.path, transcript: voice.heard.transcript, lang: voice.heard.transcriptLang, customerText: voice.heard.customerText }
        : voice.status === 'off'
          ? { path: voice.path, transcript: '', lang: null, customerText: '' }
          : null;
    const r = await markFixedAction(snag.id, { photoPaths: [photo.path], fromGallery: photo.fromGallery, voice: v }).catch(() => null);
    setSending(false);
    if (!r) return setError(w.failed);
    if (!r.ok) return setError(r.error);
    setSent(true);
  };

  const hint = !snag.canFix
    ? w.notYours
    : sent
      ? fill(w.hintReady, { name })
      : !photo
        ? w.hintNoPhoto
        : photo.status === 'saving'
          ? w.hintSaving
          : photo.status === 'failed'
            ? w.saveFailed
            : fill(w.hintReady, { name });

  const afterSrc = photo?.preview ?? (sent ? snag.after : null);
  const micIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', flexDirection: 'column' }}>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void onPhoto(e.target.files?.[0], false);
          e.target.value = '';
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void onPhoto(e.target.files?.[0], true);
          e.target.value = '';
        }}
      />

      <div className="st-backhead">
        <Link href="/studio/site/snag" aria-label={w.back}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="sub">{fill(w.snagOf, { home: snag.home })}</span>
          <h1>{snag.title}</h1>
        </div>
      </div>

      <div className="st-page" style={{ flex: 1, paddingTop: 8, gap: 12 }}>
        <div className="st-sec">
          <div className="st-pills">
            {snag.fixByLabel ? <span className={`st-pill ${snag.overdue ? 'bad' : 'warn'}`}>{fill(snag.overdue ? w.late : w.fixBy, { date: snag.fixByLabel })}</span> : null}
            {snag.room ? <span className="st-pill">{snag.room}</span> : null}
            {snag.mine ? (
              <span className="st-pill">{w.assignedYou}</span>
            ) : snag.assigneeName ? (
              <span className="st-pill">{fill(w.assignedTo, { who: snag.assigneeName })}</span>
            ) : null}
          </div>

          {snag.raisedNote || snag.raisedBy === 'customer' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="st-label">{snag.raisedBy === 'customer' ? fill(w.wrote, { name, date: snag.raisedOn }) : fill(w.teamWrote, { date: snag.raisedOn })}</span>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>&ldquo;{snag.raisedNote || snag.title}&rdquo;</p>
            </div>
          ) : null}

          {snag.state === 'reopened' && snag.notFixedReason ? (
            <div className="st-bad">
              <p style={{ fontSize: 15, fontWeight: 600 }}>{fill(w.reopened, { name })}</p>
              <p style={{ marginTop: 4, fontSize: 15, lineHeight: 1.45, color: 'var(--ink)' }}>&ldquo;{snag.notFixedReason}&rdquo;</p>
            </div>
          ) : null}

          {snag.internalNote ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="st-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                {w.noteFor}
              </span>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>{snag.internalNote}</p>
            </div>
          ) : null}
        </div>

        {/* Before and after, side by side: the customer sees the same pair. */}
        <div className="st-sec">
          <div className="st-figs">
            <figure>
              {snag.before ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={snag.before} alt={snag.title} />
              ) : (
                <div className="ph" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--muted)' }}>
                  {w.noBefore}
                </div>
              )}
              <figcaption>{snag.raisedBy === 'customer' ? fill(w.before, { name }) : w.beforeTeam}</figcaption>
            </figure>
            <figure>
              {afterSrc ? (
                <div style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={afterSrc} alt="" />
                  {photo?.status === 'saving' ? (
                    <span role="status" className="st-over">
                      {w.saving}
                    </span>
                  ) : null}
                  {photo?.status === 'failed' ? (
                    <button type="button" onClick={() => void savePhoto(photo)} className="st-over bad">
                      {w.saveFailed}
                    </button>
                  ) : null}
                </div>
              ) : (
                <button type="button" disabled={!snag.canFix || sent} onClick={() => camera.current?.click()} className="st-take">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ai">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
                    <circle className="a-flash" cx="12" cy="13" r="3.5" />
                  </svg>
                  {w.takeAfter}
                </button>
              )}
              <figcaption>
                {w.after}
                {photo?.fromGallery ? ` · ${w.fromGallery}` : ''}
              </figcaption>
            </figure>
          </div>

          {!photo && !sent && snag.canFix ? (
            <button type="button" onClick={() => gallery.current?.click()} className="st-link" style={{ alignSelf: 'flex-start' }}>
              {w.gallery}
            </button>
          ) : null}
          {photo && !sent ? (
            <button type="button" onClick={() => camera.current?.click()} className="st-link" style={{ alignSelf: 'flex-start' }}>
              {w.retake}
            </button>
          ) : null}

          {/* Step 2: once the after photo is there. Optional; never typing. */}
          {photo && !sent ? (
            <div className="st-said-box" style={{ gap: 8 }}>
              {voice.status === 'done' ? (
                <>
                  <span className="st-heard">&ldquo;{voice.heard.transcript}&rdquo;</span>
                  <span className="st-said">{voice.heard.customerText}</span>
                  <div className="st-meta">
                    <span className="mono">
                      {fill(w.reads, { name })} · {LANG_NAME[voice.heard.customerLang] ?? voice.heard.customerLang}
                    </span>
                    <button type="button" onClick={mic} className="st-redo">
                      {w.redo}
                    </button>
                  </div>
                </>
              ) : (
                <button type="button" onClick={mic} disabled={voice.status === 'hearing'} aria-pressed={voice.status === 'recording'} className={`st-mic${voice.status === 'recording' ? ' rec' : ''}`}>
                  <span aria-hidden="true">{micIcon}</span>
                  {voice.status === 'recording' ? w.listening : voice.status === 'hearing' ? w.hearing : w.say}
                </button>
              )}
              {voice.status === 'off' ? <span className="st-line">{fill(w.speechOff, { name })}</span> : null}
              {voice.status === 'blocked' ? <span className="st-line">{w.micBlocked}</span> : null}
              {voice.status === 'failed' ? <span className="st-bad-t" style={{ fontSize: 14 }}>{voice.message}</span> : null}
            </div>
          ) : null}
        </div>

        {sent ? (
          <div role="status" className="st-ok">
            <b>{fill(w.sentTitle, { name })}</b>
            <p>{fill(w.sentBody, { name })}</p>
            {snag.fixSentence && !photo ? <p style={{ color: 'var(--ink)' }}>&ldquo;{snag.fixSentence}&rdquo;</p> : null}
          </div>
        ) : null}
      </div>

      {/* The one next step, always in reach of a thumb. */}
      <div className="st-bottom">
        {sent ? (
          <Link href="/studio/site/snag" className="st-big pill">
            {w.allSnags}
          </Link>
        ) : (
          <button type="button" onClick={() => void markFixed()} aria-disabled={!ready || sending} className="st-big pill">
            {sending ? w.sending : w.markFixed}
          </button>
        )}
        <p role="status" aria-live="polite" className="hint" style={{ margin: 0, color: error ? 'var(--bad)' : undefined }}>
          {error ?? (sent && snag.state === 'fixed' && !photo ? fill(w.waiting, { name }) : hint)}
        </p>
      </div>
    </div>
  );
}
