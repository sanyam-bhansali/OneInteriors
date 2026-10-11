'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '@/modules/i18n/site';
import type { PostContext } from '@/modules/project/site-log';
import { BackIcon, CameraIcon, CheckIcon, CloudIcon, EyeIcon, GalleryIcon, MicIcon, StopIcon } from '../../icons';
import { enqueue, newClientRef, uploadFile, type QueuedCrew, type SpeechLangName } from '../../lib/queue';
import { readyPhoto, wherePhoneIs } from '../../lib/photo';
import { useOnline, useOutbox } from '../../lib/useOutbox';
import { useRecorder, type Recording } from '../../lib/useRecorder';
import { CREW_ROLES, errorWords, siteWords, type SiteT } from '../../words';

/**
 * Post today's update, in the brief's order: photos with a mic under each
 * (and "Say something else"), who is on site, what got done, what the
 * customer will read, Post. No typing is needed anywhere; the only text box
 * is the optional name of a new crew member.
 *
 * Forgiving on purpose: every voice note has Redo, a removed photo has Undo,
 * and Post waits five seconds with an Undo before the post is saved. Once
 * saved it is on the phone (IndexedDB) and sends itself — "Waiting to send"
 * → "Sent" — whatever the signal does (lib/queue.ts).
 */

type SpeechStatus = 'none' | 'working' | 'done' | 'offline' | 'off' | 'error';

interface Spoken {
  status: SpeechStatus;
  blob?: Blob;
  type?: string;
  path?: string;
  seconds?: number;
  transcript?: string;
  transcriptLang?: SpeechLangName;
  customerText?: string;
  customerLang?: SpeechLangName;
  ticks: string[];
  sample?: boolean;
}

interface Shot {
  key: string;
  url: string;
  blob: Blob;
  type: string;
  takenAt: string;
  fromGallery: boolean;
  lat: number | null;
  lng: number | null;
  room: string | null;
  spoken: Spoken;
}

const NO_SPEECH: Spoken = { status: 'none', ticks: [] };
const OTHER = 'other';
const SINCE = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00'];
const UNDO_MS = 5000;

const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const asLang = (v: unknown): SpeechLangName | undefined => (v === 'en' || v === 'hi' || v === 'mr' ? v : undefined);

export function PostUpdate({ context: c, lang }: { context: PostContext; lang: Lang }) {
  const t = siteWords(lang);
  const online = useOnline();
  const [shots, setShots] = useState<Shot[]>([]);
  const [other, setOther] = useState<Spoken>(NO_SPEECH);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [removed, setRemoved] = useState<{ shot: Shot; at: number } | null>(null);
  const [crew, setCrew] = useState<Set<string>>(new Set());
  const [newcomers, setNewcomers] = useState<{ name: string; role: string; save: boolean }[]>([]);
  const [since, setSince] = useState<string | null>(null);
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sentRef, setSentRef] = useState<string | null>(null);
  const where = useRef<{ lat: number; lng: number } | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    void wherePhoneIs().then((p) => (where.current = p));
    const made = urls.current;
    return () => made.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  /* ---------------------------------------------------------- speech */

  const setSpoken = useCallback((key: string, next: (s: Spoken) => Spoken) => {
    if (key === OTHER) setOther(next);
    else setShots((list) => list.map((s) => (s.key === key ? { ...s, spoken: next(s.spoken) } : s)));
  }, []);

  const roomOf = useRef<Record<string, string | null>>({});

  const onRecorded = useCallback(
    async (key: string, rec: Recording) => {
      setSpoken(key, () => ({ status: navigator.onLine === false ? 'offline' : 'working', blob: rec.blob, type: rec.type, seconds: rec.seconds, ticks: [] }));
      if (navigator.onLine === false) return;
      let path: string;
      try {
        path = await uploadFile(c.projectId, 'voice', rec.blob, rec.type);
      } catch {
        setSpoken(key, (s) => ({ ...s, status: 'offline' }));
        return;
      }
      setSpoken(key, (s) => ({ ...s, path, blob: undefined }));
      try {
        const res = await fetch('/api/studio/site/speech', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectId: c.projectId, voicePath: path, lang, room: roomOf.current[key] ?? null }),
        });
        const json = (await res.json()) as { ok: boolean; error?: string; heard?: Record<string, unknown> };
        if (!json.ok || !json.heard) {
          setSpoken(key, (s) => ({ ...s, status: json.error === 'speech_off' ? 'off' : 'error' }));
          return;
        }
        const h = json.heard;
        setSpoken(key, (s) => ({
          ...s,
          status: 'done',
          transcript: String(h.transcript ?? ''),
          transcriptLang: asLang(h.transcriptLang),
          customerText: String(h.customerText ?? ''),
          customerLang: asLang(h.customerLang),
          ticks: Array.isArray(h.ticks) ? h.ticks.filter((x): x is string => typeof x === 'string') : [],
          sample: h.provider === 'fake',
        }));
      } catch {
        // The voice is uploaded; the server writes the sentence when the post arrives.
        setSpoken(key, (s) => ({ ...s, status: 'offline' }));
      }
    },
    [c.projectId, lang, setSpoken],
  );

  const recorder = useRecorder((key, rec) => void onRecorded(key, rec));
  const recordingKey = recorder.state.status === 'recording' ? recorder.state.key : null;

  const tapMic = (key: string) => {
    if (recordingKey === key) recorder.stop();
    else if (!recordingKey) void recorder.start(key);
  };

  /* ---------------------------------------------------------- photos */

  const addFiles = async (files: FileList | null, viaGallery: boolean) => {
    if (!files?.length) return;
    setBusyPhoto(true);
    setPhotoError(false);
    const pos = where.current;
    void wherePhoneIs().then((p) => p && (where.current = p));
    for (const file of Array.from(files).slice(0, 12)) {
      try {
        const ready = await readyPhoto(file, viaGallery);
        const url = URL.createObjectURL(ready.blob);
        urls.current.push(url);
        const key = newClientRef();
        setShots((list) => [...list, { key, url, ...ready, lat: pos?.lat ?? null, lng: pos?.lng ?? null, room: null, spoken: NO_SPEECH }].slice(0, 12));
      } catch {
        setPhotoError(true);
      }
    }
    setBusyPhoto(false);
  };

  const removeShot = (key: string) => {
    const shot = shots.find((s) => s.key === key);
    if (!shot) return;
    setShots((list) => list.filter((s) => s.key !== key));
    setRemoved({ shot, at: Date.now() });
  };
  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(timer);
  }, [removed]);

  const setRoom = (key: string, room: string | null) => {
    roomOf.current[key] = room;
    setShots((list) => list.map((s) => (s.key === key ? { ...s, room } : s)));
  };

  /* ---------------------------------------------------------- ticks */

  const suggested = useMemo(() => new Set([...shots.flatMap((s) => s.spoken.ticks), ...other.ticks]), [shots, other]);
  const isOn = (id: string) => (id in manual ? manual[id]! : suggested.has(id));
  const openItems = c.items.filter((i) => !i.done);
  const doneItems = c.items.filter((i) => i.done);
  const ticks = openItems.filter((i) => isOn(i.id)).map((i) => ({ itemId: i.id, source: (!(i.id in manual) && suggested.has(i.id) ? 'VOICE' : 'TICK') as 'VOICE' | 'TICK' }));

  /* ---------------------------------------------------------- post */

  const sentences = [...shots.map((s) => s.spoken.customerText), other.customerText].filter((s): s is string => !!s);
  const speaking = recordingKey !== null || shots.some((s) => s.spoken.status === 'working') || other.status === 'working';
  const canPost = (shots.length > 0 || other.status !== 'none' || ticks.length > 0) && !speaking && !busyPhoto;

  const save = async () => {
    const clientRef = newClientRef();
    const arrivedAt = since ? new Date(`${istToday()}T${since}:00+05:30`).toISOString() : null;
    const people: QueuedCrew[] = [
      ...[...crew].map((id) => ({ crewMemberId: id, arrivedAt })),
      ...newcomers.map((n) => ({ crewMemberId: null, name: n.name, role: n.role, arrivedAt, save: n.save })),
    ];
    const voiceOf = (s: Spoken) =>
      s.status === 'none'
        ? null
        : { blob: s.blob, type: s.type, path: s.path, transcript: s.transcript ?? null, transcriptLang: s.transcriptLang ?? null, customerText: s.customerText ?? null, customerLang: s.customerLang ?? null };
    await enqueue({
      clientRef,
      projectId: c.projectId,
      home: c.home,
      kind: 'UPDATE',
      reason: null,
      postedAt: new Date().toISOString(),
      photos: shots.map((s) => ({ key: s.key, blob: s.blob, type: s.type, takenAt: s.takenAt, fromGallery: s.fromGallery, lat: s.lat, lng: s.lng, voice: voiceOf(s.spoken) })),
      voice: voiceOf(other),
      crew: people,
      ticks,
    });
    setSentRef(clientRef);
  };
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      void saveRef.current();
      return;
    }
    const timer = setTimeout(() => setCountdown((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  if (sentRef) return <Posted clientRef={sentRef} c={c} t={t} local={{ photos: shots.length, crew: crew.size + newcomers.length, ticked: ticks.length }} />;

  const langName = t(`lang.${c.customerLang}`);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-2 pt-2">
        <Link href="/studio/site" aria-label={t('post.back')} className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--s-ink)]">
          <BackIcon />
        </Link>
        <div className="min-w-0">
          <h1 className="m-0 text-[22px] font-semibold tracking-tight">{t('post.h1')}</h1>
          <p className="m-0 truncate text-[14px] text-[var(--s-ink-2)]">{c.home}</p>
        </div>
      </div>

      <div className="flex flex-col gap-7 px-4 pb-32 pt-4">
        {c.today ? (
          <p className="m-0 rounded-[14px] bg-[var(--s-accent-wash)] p-3.5 text-[14.5px] leading-relaxed text-[var(--s-accent-deep)]">
            {t('post.adding', { time: new Date(c.today.postedAt).toLocaleTimeString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }), customer: c.customerFirst })}
          </p>
        ) : null}

        {/* 1 · Photos */}
        <section aria-labelledby="h-photos" className="flex flex-col gap-3">
          <div>
            <h2 id="h-photos" className="m-0 text-[18px] font-semibold">
              {t('s1.h')}
            </h2>
            <p className="m-0 mt-0.5 text-[14px] text-[var(--s-ink-2)]">{t('s1.sub')}</p>
          </div>

          {shots.map((s, i) => (
            <div key={s.key} className="s-card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={t('photo.n', { n: i + 1 })} className="block aspect-[4/3] w-full bg-[var(--s-surface-2)] object-cover" />
              <div className="flex flex-col gap-3 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--s-ink-3)]">
                    {t('photo.n', { n: i + 1 })} · {new Date(s.takenAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                  </span>
                  <button type="button" onClick={() => removeShot(s.key)} className="min-h-[44px] px-2 text-[14px] text-[var(--s-ink-2)] underline">
                    {t('photo.remove')}
                  </button>
                </div>
                {s.fromGallery ? <span className="self-start rounded-full bg-[var(--s-warn-wash)] px-2.5 py-1 text-[12.5px] text-[var(--s-warn)]">{t('photo.galleryTag')}</span> : null}
                {c.rooms.length ? (
                  <div role="group" aria-label={t('photo.room')} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    {c.rooms.map((room) => (
                      <button
                        key={room}
                        type="button"
                        aria-pressed={s.room === room}
                        onClick={() => setRoom(s.key, s.room === room ? null : room)}
                        className={`min-h-[40px] flex-none rounded-full px-3.5 text-[14px] ${s.room === room ? 'bg-[var(--s-ink)] text-white' : 'bg-[var(--s-surface-2)] text-[var(--s-ink)]'}`}
                      >
                        {room}
                      </button>
                    ))}
                  </div>
                ) : null}
                <Mic spoken={s.spoken} recording={recordingKey === s.key} blocked={recordingKey !== null && recordingKey !== s.key} onTap={() => tapMic(s.key)} label={t('mic.speak')} t={t} c={c} />
              </div>
            </div>
          ))}

          {removed ? (
            <div role="status" className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--s-ink)] px-4 py-2 text-white">
              <span className="text-[14.5px]">{t('photo.removed')}</span>
              <button
                type="button"
                onClick={() => {
                  setShots((list) => [...list, removed.shot]);
                  setRemoved(null);
                }}
                className="min-h-[44px] px-2 text-[15px] font-semibold underline"
              >
                {t('undo')}
              </button>
            </div>
          ) : null}

          {shots.length === 0 ? <p className="m-0 text-[14px] text-[var(--s-ink-3)]">{t('photo.corner')}</p> : null}
          <div className="grid grid-cols-[1fr_auto] gap-2.5">
            <button
              type="button"
              onClick={() => cameraInput.current?.click()}
              disabled={busyPhoto || shots.length >= 12}
              className="flex min-h-[64px] items-center justify-center gap-2.5 rounded-[14px] bg-[var(--s-accent)] px-4 text-[17px] font-semibold text-white disabled:opacity-50"
            >
              <CameraIcon />
              {busyPhoto ? t('photo.working') : shots.length === 0 ? t('photo.first') : t('photo.another')}
            </button>
            <button
              type="button"
              onClick={() => galleryInput.current?.click()}
              disabled={busyPhoto || shots.length >= 12}
              className="flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-[14px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 text-[13px] text-[var(--s-ink-2)] disabled:opacity-50"
            >
              <GalleryIcon />
              {t('photo.gallery')}
            </button>
          </div>
          {photoError ? <p className="m-0 text-[14px] text-[var(--s-bad)]">{t('photo.bad')}</p> : null}
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void addFiles(e.target.files, false).then(() => (e.target.value = ''))} />
          <input ref={galleryInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addFiles(e.target.files, true).then(() => (e.target.value = ''))} />

          <div className="s-card p-3.5">
            <Mic spoken={other} recording={recordingKey === OTHER} blocked={recordingKey !== null && recordingKey !== OTHER} onTap={() => tapMic(OTHER)} label={t('mic.other')} t={t} c={c} quiet />
          </div>
          {recorder.state.status === 'denied' || recorder.state.status === 'unsupported' ? <p className="m-0 text-[14px] text-[var(--s-bad)]">{t('mic.denied')}</p> : null}
        </section>

        {/* 2 · Crew */}
        <section aria-labelledby="h-crew" className="flex flex-col gap-3">
          <h2 id="h-crew" className="m-0 text-[18px] font-semibold">
            {t('s2.h')}
          </h2>
          {c.crew.length === 0 && newcomers.length === 0 ? <p className="m-0 text-[14px] text-[var(--s-ink-3)]">{t('crew.none')}</p> : null}
          <div role="group" aria-labelledby="h-crew" className="flex flex-wrap gap-2">
            {c.crew.map((m) => {
              const on = crew.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setCrew((set) => {
                      const next = new Set(set);
                      if (on) next.delete(m.id);
                      else next.add(m.id);
                      return next;
                    })
                  }
                  className={`flex min-h-[56px] items-center gap-2 rounded-full px-4 text-[15.5px] ${on ? 'bg-[var(--s-ink)] text-white' : 'bg-[var(--s-surface-2)] text-[var(--s-ink)]'}`}
                >
                  {on ? <CheckIcon /> : null}
                  {m.name} · {m.role}
                </button>
              );
            })}
            {newcomers.map((n, i) => (
              <button
                key={`new-${i}`}
                type="button"
                aria-pressed
                onClick={() => setNewcomers((list) => list.filter((_, j) => j !== i))}
                className="flex min-h-[56px] items-center gap-2 rounded-full bg-[var(--s-ink)] px-4 text-[15.5px] text-white"
              >
                <CheckIcon />
                {n.name} · {t(`role.${n.role as (typeof CREW_ROLES)[number]}`)}
              </button>
            ))}
          </div>
          <AddCrew t={t} canSave={c.canSaveCrew} onAdd={(n) => setNewcomers((list) => [...list, n])} />
          {crew.size + newcomers.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-[14px] text-[var(--s-ink-2)]">{t('crew.since')}</p>
              <div role="radiogroup" aria-label={t('crew.since')} className="flex flex-wrap gap-2">
                {SINCE.map((hhmm) => (
                  <button
                    key={hhmm}
                    type="button"
                    role="radio"
                    aria-checked={since === hhmm}
                    onClick={() => setSince(since === hhmm ? null : hhmm)}
                    className={`min-h-[48px] min-w-[64px] rounded-full px-3 font-[family-name:var(--font-mono)] text-[14.5px] ${since === hhmm ? 'bg-[var(--s-accent)] text-white' : 'bg-[var(--s-surface-2)] text-[var(--s-ink)]'}`}
                  >
                    {Number(hhmm.slice(0, 2)) > 12 ? `${Number(hhmm.slice(0, 2)) - 12} pm` : `${Number(hhmm.slice(0, 2))} ${hhmm === '12:00' ? 'pm' : 'am'}`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* 3 · What got done */}
        <section aria-labelledby="h-done" className="flex flex-col gap-2.5">
          <div>
            <h2 id="h-done" className="m-0 text-[18px] font-semibold">
              {t('s3.h')}
            </h2>
            {openItems.length ? <p className="m-0 mt-0.5 text-[14px] text-[var(--s-ink-2)]">{c.stage ? `${c.stage.name} · ` : ''}{t('s3.sub')}</p> : null}
          </div>
          {openItems.length === 0 ? <p className="m-0 text-[14px] text-[var(--s-ink-3)]">{t('s3.none')}</p> : null}
          {c.canTick
            ? openItems.map((item) => {
                const on = isOn(item.id);
                const fromVoice = on && !(item.id in manual) && suggested.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => setManual((m) => ({ ...m, [item.id]: !on }))}
                    className={`flex min-h-[64px] items-center gap-3.5 rounded-[14px] px-4 py-3 text-left ${on ? 'bg-[var(--s-good-wash)]' : 'bg-[var(--s-surface-2)]'}`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] border-2 text-white"
                      style={on ? { background: 'var(--s-good)', borderColor: 'var(--s-good)' } : { borderColor: 'var(--s-ink-3)' }}
                    >
                      {on ? <CheckIcon /> : null}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[16px] font-medium leading-snug">{item.label}</span>
                      <span className={`text-[13.5px] ${fromVoice ? 'font-medium text-[var(--s-good)]' : 'text-[var(--s-ink-3)]'}`}>
                        {item.room}
                        {fromVoice ? ` · ${t('tick.voice')}` : ''}
                      </span>
                    </span>
                  </button>
                );
              })
            : null}
          {doneItems.length ? (
            <p className="m-0 text-[13.5px] text-[var(--s-ink-3)]">
              {t('tick.earlier')}: {doneItems.length}
            </p>
          ) : null}
        </section>

        {/* 4 · Preview */}
        <section aria-labelledby="h-reads" className="flex flex-col gap-2 rounded-[14px] p-4 text-white" style={{ background: 'var(--s-accent-deep)' }}>
          <span id="h-reads" className="inline-flex items-center gap-1.5 text-[14px] font-semibold">
            <EyeIcon />
            {t('s4.h', { customer: c.customerFirst, lang: langName })}
          </span>
          {sentences.length ? (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {sentences.map((s, i) => (
                <li key={i} className="text-[16px] leading-relaxed">
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[15px] leading-relaxed text-white/75">{t('s4.empty')}</p>
          )}
          <span className="text-[13px] text-white/70">{t('s4.note')}</span>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--s-rule)] bg-[var(--s-surface)] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-[528px] items-center gap-2.5">
          {countdown !== null ? (
            <>
              <span role="status" className="flex min-h-[60px] flex-1 items-center justify-center rounded-[14px] bg-[var(--s-accent-wash)] text-[16px] font-semibold text-[var(--s-accent-deep)]">
                {t('post.posting', { s: countdown })}
              </span>
              <button type="button" onClick={() => setCountdown(null)} className="min-h-[60px] rounded-[14px] border-2 border-[var(--s-ink)] px-5 text-[16px] font-semibold">
                {t('undo')}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={!canPost}
              onClick={() => setCountdown(UNDO_MS / 1000)}
              className="flex min-h-[60px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-[var(--s-accent)] text-[17px] font-semibold text-white disabled:opacity-40"
            >
              {!online ? <CloudIcon /> : null}
              {shots.length === 0 && other.status === 'none' && ticks.length === 0 ? t('post.needPhoto') : t('post.btn')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The mic under a photo (or "Say something else"): record, see what was heard and what the customer reads, Redo. */
function Mic({
  spoken: s,
  recording,
  blocked,
  onTap,
  label,
  t,
  c,
  quiet = false,
}: {
  spoken: Spoken;
  recording: boolean;
  blocked: boolean;
  onTap: () => void;
  label: string;
  t: SiteT;
  c: PostContext;
  quiet?: boolean;
}) {
  if (recording) {
    return (
      <button type="button" onClick={onTap} className="flex min-h-[60px] items-center justify-center gap-2.5 rounded-[14px] bg-[var(--s-bad)] px-4 text-[16px] font-semibold text-white">
        <StopIcon />
        {t('mic.stop')}
      </button>
    );
  }
  if (s.status === 'none') {
    return (
      <button
        type="button"
        onClick={onTap}
        disabled={blocked}
        className={`flex min-h-[60px] items-center justify-center gap-2.5 rounded-[14px] px-4 text-[16px] font-semibold disabled:opacity-40 ${
          quiet ? 'border border-[var(--s-rule)] bg-[var(--s-surface)] text-[var(--s-ink)]' : 'bg-[var(--s-accent-wash)] text-[var(--s-accent-deep)]'
        }`}
      >
        <MicIcon />
        {label}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-[var(--s-surface-2)] p-3">
      {quiet ? <span className="text-[13px] font-semibold text-[var(--s-ink-2)]">{label}</span> : null}
      {s.status === 'working' ? <p className="m-0 text-[15px] text-[var(--s-ink-2)]">{t('mic.working')}</p> : null}
      {s.status === 'offline' ? <p className="m-0 text-[14.5px] text-[var(--s-ink-2)]">{t('mic.offline')}</p> : null}
      {s.status === 'off' || s.status === 'error' ? <p className="m-0 text-[14.5px] text-[var(--s-ink-2)]">{t('mic.off')}</p> : null}
      {s.status === 'done' ? (
        <>
          <p className="m-0 text-[13px] text-[var(--s-ink-3)]">
            {t('mic.heard')}
            {s.sample ? ` · ${t('mic.sample')}` : ''}
          </p>
          <p className="m-0 text-[15px] italic text-[var(--s-ink-2)]">“{s.transcript}”</p>
          <p className="m-0 mt-1 text-[13px] text-[var(--s-ink-3)]">{t('mic.reads', { customer: c.customerFirst })}</p>
          <p className="m-0 text-[16px] font-medium leading-snug">{s.customerText}</p>
        </>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--s-ink-3)]">{s.seconds ? `0:${String(s.seconds).padStart(2, '0')}` : ''}</span>
        <button
          type="button"
          onClick={onTap}
          disabled={blocked || s.status === 'working'}
          className="flex min-h-[48px] items-center gap-1.5 rounded-full border border-[var(--s-rule)] bg-[var(--s-surface)] px-4 text-[15px] font-medium disabled:opacity-40"
        >
          <MicIcon size={18} />
          {t('mic.redo')}
        </button>
      </div>
    </div>
  );
}

/** "+ Add someone": a name, a tap on what they do. Saved to the crew list only by those who manage it. */
function AddCrew({ t, canSave, onAdd }: { t: SiteT; canSave: boolean; onAdd: (n: { name: string; role: string; save: boolean }) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>(CREW_ROLES[0]);
  const [keep, setKeep] = useState(true);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-[52px] self-start rounded-full border border-dashed border-[var(--s-ink-3)] px-4 text-[15px] text-[var(--s-ink)]">
        {t('crew.add')}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] bg-[var(--s-surface-2)] p-3.5">
      <label className="flex flex-col gap-1 text-[14px] text-[var(--s-ink-2)]">
        {t('crew.name')}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" className="min-h-[52px] rounded-[12px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 text-[17px] text-[var(--s-ink)]" />
      </label>
      <div role="radiogroup" aria-label={t('crew.role')} className="flex flex-wrap gap-2">
        {CREW_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            className={`min-h-[48px] rounded-full px-3.5 text-[15px] ${role === r ? 'bg-[var(--s-ink)] text-white' : 'bg-[var(--s-surface)] text-[var(--s-ink)]'}`}
          >
            {t(`role.${r}`)}
          </button>
        ))}
      </div>
      {canSave ? (
        <label className="flex min-h-[44px] items-center gap-2.5 text-[15px]">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="h-6 w-6" />
          {t('crew.keep')}
        </label>
      ) : null}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          disabled={name.trim().length < 2}
          onClick={() => {
            onAdd({ name: name.trim(), role, save: canSave && keep });
            setName('');
            setOpen(false);
          }}
          className="min-h-[52px] rounded-[12px] bg-[var(--s-accent)] text-[16px] font-semibold text-white disabled:opacity-40"
        >
          {t('crew.save')}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-[52px] px-4 text-[15px] text-[var(--s-ink-2)]">
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}

/** After Post: saved on the phone → sent, and what changed in the customer's app. */
function Posted({ clientRef, c, t, local }: { clientRef: string; c: PostContext; t: SiteT; local: { photos: number; crew: number; ticked: number } }) {
  const posts = useOutbox();
  const p = posts.find((x) => x.clientRef === clientRef);
  const sent = p?.status === 'sent';
  const failed = p?.status === 'failed';
  const r = p?.result;
  return (
    <div className="flex flex-col gap-5 px-4 py-8">
      <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ background: sent ? 'var(--s-good)' : failed ? 'var(--s-bad)' : 'var(--s-warn)' }}>
        {sent ? <CheckIcon size={30} /> : <CloudIcon size={30} />}
      </span>
      <div role="status">
        <h2 className="m-0 text-[24px] font-semibold tracking-tight">{sent ? t('done.sent.h', { customer: c.customerFirst }) : t('done.saved.h')}</h2>
        <p className="m-0 mt-1.5 text-[16px] leading-relaxed text-[var(--s-ink-2)]">
          {failed
            ? t('queue.failed', { error: errorWords(t, p?.error ?? undefined) })
            : sent
              ? `${t('done.line', { photos: r?.photos ?? local.photos, crew: r?.crew ?? local.crew, ticked: r?.ticked ?? local.ticked })}${r?.stage ? ` · ${r.stage}` : ''}.`
              : `${p?.status === 'sending' ? t('queue.sending') : t('queue.waiting')}. ${t('done.saved.p', { customer: c.customerFirst })}`}
        </p>
      </div>
      <div className="s-card flex flex-col gap-1 p-4">
        <span className="text-[14px] font-semibold">{t('done.where', { customer: c.customerFirst })}</span>
        <span className="text-[14px] text-[var(--s-ink-2)]">{t('done.where2')}</span>
        <span className="mt-2 text-[13.5px] text-[var(--s-ink-3)]">{t('done.fix')}</span>
      </div>
      <Link href="/studio/site" className="flex min-h-[60px] items-center justify-center rounded-[14px] bg-[var(--s-accent)] text-[17px] font-semibold text-white no-underline">
        {t('post.back')}
      </Link>
    </div>
  );
}
