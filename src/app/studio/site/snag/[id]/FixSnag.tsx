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
  const chip = 'inline-flex min-h-[32px] items-center rounded-full px-3 text-[14px] font-medium';

  return (
    <div className="flex min-h-[calc(100dvh-60px)] flex-col">
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

      <div className="flex items-start gap-2 px-4 pt-4">
        <Link href="/studio/site/snag" aria-label={w.back} className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-full text-[var(--s-ink)] no-underline">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div className="min-w-0 pt-1">
          <p className="m-0 text-[13.5px] text-[var(--s-ink-3)]">{fill(w.snagOf, { home: snag.home })}</p>
          <h1 className="m-0 mt-0.5 text-[24px] font-semibold leading-tight tracking-[-0.01em]">{snag.title}</h1>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-4">
        <div className="flex flex-wrap gap-2">
          {snag.fixByLabel ? (
            <span
              className={chip}
              style={snag.overdue ? { background: 'var(--s-bad-wash)', color: 'var(--s-bad)' } : { background: 'var(--s-accent-wash)', color: 'var(--s-accent)' }}
            >
              {fill(snag.overdue ? w.late : w.fixBy, { date: snag.fixByLabel })}
            </span>
          ) : null}
          {snag.room ? <span className={`${chip} bg-[var(--s-surface-2)] text-[var(--s-ink-2)]`}>{snag.room}</span> : null}
          {snag.mine ? (
            <span className={`${chip} bg-[var(--s-surface-2)] text-[var(--s-ink-2)]`}>{w.assignedYou}</span>
          ) : snag.assigneeName ? (
            <span className={`${chip} bg-[var(--s-surface-2)] text-[var(--s-ink-2)]`}>{fill(w.assignedTo, { who: snag.assigneeName })}</span>
          ) : null}
        </div>

        {snag.raisedNote || snag.raisedBy === 'customer' ? (
          <div className="s-card p-4">
            <p className="m-0 text-[13px] text-[var(--s-ink-3)]">
              {snag.raisedBy === 'customer' ? fill(w.wrote, { name, date: snag.raisedOn }) : fill(w.teamWrote, { date: snag.raisedOn })}
            </p>
            <p className="m-0 mt-1 text-[16px] leading-relaxed">“{snag.raisedNote || snag.title}”</p>
          </div>
        ) : null}

        {snag.state === 'reopened' && snag.notFixedReason ? (
          <div className="rounded-[12px] p-4" style={{ background: 'var(--s-bad-wash)' }}>
            <p className="m-0 text-[15px] font-medium" style={{ color: 'var(--s-bad)' }}>
              {fill(w.reopened, { name })}
            </p>
            <p className="m-0 mt-1 text-[15px] leading-relaxed">“{snag.notFixedReason}”</p>
          </div>
        ) : null}

        {snag.internalNote ? (
          <div className="rounded-[12px] border border-[var(--s-rule)] bg-[var(--s-surface-2)] p-4">
            <p className="m-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--s-ink-2)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              {w.noteFor}
            </p>
            <p className="m-0 mt-1 text-[16px] leading-relaxed">{snag.internalNote}</p>
          </div>
        ) : null}

        {/* Before and after, side by side: the customer sees the same pair. */}
        <div className="grid grid-cols-2 gap-3">
          <figure className="m-0 flex flex-col gap-1.5">
            {snag.before ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={snag.before} alt={snag.title} className="aspect-[3/4] w-full rounded-[14px] object-cover" />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center rounded-[14px] bg-[var(--s-surface-2)] text-[14px] text-[var(--s-ink-3)]">{w.noBefore}</div>
            )}
            <figcaption className="text-[13px] text-[var(--s-ink-3)]">{snag.raisedBy === 'customer' ? fill(w.before, { name }) : w.beforeTeam}</figcaption>
          </figure>
          <figure className="m-0 flex flex-col gap-1.5">
            {afterSrc ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={afterSrc} alt="" className="aspect-[3/4] w-full rounded-[14px] object-cover" />
                {photo?.status === 'saving' ? (
                  <span role="status" className="absolute inset-x-2 bottom-2 rounded-full bg-black/65 px-2 py-1 text-center text-[12.5px] text-white">
                    {w.saving}
                  </span>
                ) : null}
                {photo?.status === 'failed' ? (
                  <button
                    type="button"
                    onClick={() => void savePhoto(photo)}
                    className="absolute inset-x-2 bottom-2 min-h-[44px] rounded-[10px] px-2 text-[13px] font-medium text-white"
                    style={{ background: 'var(--s-bad)' }}
                  >
                    {w.saveFailed}
                  </button>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                disabled={!snag.canFix || sent}
                onClick={() => camera.current?.click()}
                className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed px-3 text-center text-[16px] font-semibold disabled:opacity-50"
                style={{ borderColor: 'var(--s-accent)', color: 'var(--s-accent)', background: 'var(--s-accent-wash)' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                {w.takeAfter}
              </button>
            )}
            <figcaption className="text-[13px] text-[var(--s-ink-3)]">
              {w.after}
              {photo?.fromGallery ? ` · ${w.fromGallery}` : ''}
            </figcaption>
          </figure>
        </div>

        {!photo && !sent && snag.canFix ? (
          <button type="button" onClick={() => gallery.current?.click()} className="min-h-[44px] self-start text-[14px] text-[var(--s-ink-2)] underline underline-offset-2">
            {w.gallery}
          </button>
        ) : null}
        {photo && !sent ? (
          <button type="button" onClick={() => camera.current?.click()} className="min-h-[44px] self-start text-[14px] text-[var(--s-ink-2)] underline underline-offset-2">
            {w.retake}
          </button>
        ) : null}

        {/* Step 2: once the after photo is there. Optional; never typing. */}
        {photo && !sent ? (
          <div className="flex flex-col gap-2">
            {voice.status === 'done' ? (
              <div className="s-card flex flex-col gap-2 p-4">
                <p className="m-0 text-[14px] text-[var(--s-ink-3)]">“{voice.heard.transcript}”</p>
                <p className="m-0 text-[17px] font-medium leading-snug">{voice.heard.customerText}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-[var(--s-ink-3)]">
                    {fill(w.reads, { name })} · {LANG_NAME[voice.heard.customerLang] ?? voice.heard.customerLang}
                  </span>
                  <button type="button" onClick={mic} className="min-h-[44px] rounded-full px-4 text-[15px] font-medium text-[var(--s-accent)]" style={{ background: 'var(--s-accent-wash)' }}>
                    {w.redo}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={mic}
                disabled={voice.status === 'hearing'}
                aria-pressed={voice.status === 'recording'}
                className="flex min-h-[64px] w-full items-center justify-center gap-3 rounded-full px-5 text-[17px] font-semibold disabled:opacity-60"
                style={
                  voice.status === 'recording'
                    ? { background: 'var(--s-bad)', color: '#fff' }
                    : { background: 'var(--s-surface)', color: 'var(--s-ink)', boxShadow: 'inset 0 0 0 2px var(--s-accent)' }
                }
              >
                <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-full" style={{ background: voice.status === 'recording' ? 'rgba(255,255,255,.2)' : 'var(--s-accent)', color: '#fff' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                </span>
                {voice.status === 'recording' ? w.listening : voice.status === 'hearing' ? w.hearing : w.say}
              </button>
            )}
            {voice.status === 'off' ? <p className="m-0 text-[14px] text-[var(--s-ink-2)]">{fill(w.speechOff, { name })}</p> : null}
            {voice.status === 'blocked' ? <p className="m-0 text-[14px] text-[var(--s-ink-2)]">{w.micBlocked}</p> : null}
            {voice.status === 'failed' ? (
              <p className="m-0 text-[14px]" style={{ color: 'var(--s-bad)' }}>
                {voice.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {sent ? (
          <div role="status" className="rounded-[14px] p-4" style={{ background: 'var(--s-good-wash)' }}>
            <p className="m-0 text-[17px] font-semibold" style={{ color: 'var(--s-good)' }}>
              {fill(w.sentTitle, { name })}
            </p>
            <p className="m-0 mt-1 text-[15px] leading-relaxed text-[var(--s-ink-2)]">{fill(w.sentBody, { name })}</p>
            {snag.fixSentence && !photo ? <p className="m-0 mt-2 text-[15px]">“{snag.fixSentence}”</p> : null}
          </div>
        ) : null}
      </div>

      {/* The one next step, always in reach of a thumb. */}
      <div className="sticky bottom-0 border-t border-[var(--s-rule)] bg-[var(--s-ground)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        {sent ? (
          <Link
            href="/studio/site/snag"
            className="flex min-h-[60px] w-full items-center justify-center rounded-full text-[17px] font-semibold no-underline"
            style={{ background: 'var(--s-accent)', color: '#fff' }}
          >
            {w.allSnags}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void markFixed()}
            aria-disabled={!ready || sending}
            className="flex min-h-[60px] w-full items-center justify-center rounded-full text-[18px] font-semibold"
            style={ready && !sending ? { background: 'var(--s-ink)', color: '#fff' } : { background: '#C9CABB', color: '#4F5147' }}
          >
            {sending ? w.sending : w.markFixed}
          </button>
        )}
        <p role="status" aria-live="polite" className="m-0 mt-2 text-center text-[14px]" style={{ color: error ? 'var(--s-bad)' : 'var(--s-ink-2)' }}>
          {error ?? (sent && snag.state === 'fixed' && !photo ? fill(w.waiting, { name }) : hint)}
        </p>
      </div>
    </div>
  );
}
