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
 * customer will read, Post.
 *
 * What got done is the plan's steps (the step tracker,
 * docs/studio-workspace/STEP-TRACKER.md), grouped by stage and group.
 * Ticking a step opens its own photo slot: the photo that shows it done and
 * the sentence the customer reads under it — said into its mic, or typed
 * (the box starts with what the mic wrote, so it can be corrected). The
 * preview shows "Done: {step}" with that sentence. Post waits until every
 * ticked step has both; the server refuses a tick without them anyway.
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
  /** The step this photo shows done; null for a general photo. */
  stepId: string | null;
  /** The sentence as typed (or corrected); null = use what the mic wrote. */
  typed: string | null;
}

const NO_SPEECH: Spoken = { status: 'none', ticks: [] };
const OTHER = 'other';
const MAX_SHOTS = 12;
/** What the customer reads under a photo: the typed sentence, else the mic's. Matches site-log-rules.ts. */
const sentenceOf = (s: Shot): string => s.typed?.trim() || s.spoken.customerText?.trim() || '';

const SINCE = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00'];
const UNDO_MS = 5000;

const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const asLang = (v: unknown): SpeechLangName | undefined => (v === 'en' || v === 'hi' || v === 'mr' ? v : undefined);

export function PostUpdate({ context: c, lang }: { context: PostContext; lang: Lang }) {
  const t = siteWords(lang);
  const online = useOnline();
  const [shots, setShots] = useState<Shot[]>([]);
  const [other, setOther] = useState<Spoken>(NO_SPEECH);
  const [busyPhoto, setBusyPhoto] = useState<string | null>(null);
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
  /** Which step the next picked photo is for (null = a general photo). */
  const target = useRef<string | null>(null);
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

  /** Photos into the post: general ones (up to 12 in all), or the one photo of a ticked step (replacing its last). */
  const addFiles = async (files: FileList | null, viaGallery: boolean) => {
    const stepId = target.current;
    target.current = null;
    if (!files?.length) return;
    setBusyPhoto(stepId ?? OTHER);
    setPhotoError(false);
    const pos = where.current;
    void wherePhoneIs().then((p) => p && (where.current = p));
    for (const file of Array.from(files).slice(0, stepId ? 1 : MAX_SHOTS)) {
      try {
        const ready = await readyPhoto(file, viaGallery);
        const url = URL.createObjectURL(ready.blob);
        urls.current.push(url);
        const key = newClientRef();
        const shot: Shot = { key, url, ...ready, lat: pos?.lat ?? null, lng: pos?.lng ?? null, room: null, spoken: NO_SPEECH, stepId, typed: null };
        setShots((list) => {
          if (stepId) {
            const was = list.find((s) => s.stepId === stepId);
            // A new photo for the step keeps what was already said or typed about it.
            return [...list.filter((s) => s.stepId !== stepId), was ? { ...shot, spoken: was.spoken, typed: was.typed } : shot];
          }
          return [...list, shot].slice(0, MAX_SHOTS);
        });
      } catch {
        setPhotoError(true);
      }
    }
    setBusyPhoto(null);
  };

  const pickPhoto = (stepId: string | null, how: 'camera' | 'gallery') => {
    target.current = stepId;
    (how === 'camera' ? cameraInput : galleryInput).current?.click();
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

  const setTyped = (key: string, typed: string) => setShots((list) => list.map((s) => (s.key === key ? { ...s, typed } : s)));

  /* ---------------------------------------------------------- ticks */

  const suggested = useMemo(() => new Set([...shots.flatMap((s) => s.spoken.ticks), ...other.ticks]), [shots, other]);
  const isOn = (id: string) => (id in manual ? manual[id]! : suggested.has(id));
  const openItems = c.items.filter((i) => !i.done);
  const doneItems = c.items.filter((i) => i.done);
  const onItems = c.canTick ? openItems.filter((i) => isOn(i.id)) : [];
  const stepShot = (id: string) => shots.find((s) => s.stepId === id) ?? null;
  /* A ticked step needs its photo and a sentence: typed, from its mic, or a
     recording saved offline that is written down when it sends. */
  const stepReady = (id: string) => {
    const s = stepShot(id);
    return !!s && (sentenceOf(s).length > 0 || s.spoken.status === 'offline');
  };
  const missing = onItems.filter((i) => !stepReady(i.id));
  const generalShots = shots.filter((s) => !s.stepId);
  const stepShots = onItems.map((i) => stepShot(i.id)).filter((s): s is Shot => s !== null);
  /** What is posted, in order: the general photos, then one per ticked step. */
  const posted = [...generalShots, ...stepShots];
  const ticks = onItems
    .filter((i) => stepShot(i.id))
    .map((i) => ({
      itemId: i.id,
      source: (!(i.id in manual) && suggested.has(i.id) ? 'VOICE' : 'TICK') as 'VOICE' | 'TICK',
      photoIndex: posted.indexOf(stepShot(i.id)!),
    }));

  /* ---------------------------------------------------------- post */

  const sentences = [...generalShots.map((s) => sentenceOf(s)), other.customerText ?? ''].filter((s) => s.length > 0);
  const speaking = recordingKey !== null || shots.some((s) => s.spoken.status === 'working') || other.status === 'working';
  const hasSomething = posted.length > 0 || other.status !== 'none';
  const canPost = hasSomething && missing.length === 0 && !speaking && busyPhoto === null;

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
      photos: posted.map((s) => ({
        key: s.key,
        blob: s.blob,
        type: s.type,
        takenAt: s.takenAt,
        fromGallery: s.fromGallery,
        lat: s.lat,
        lng: s.lng,
        voice: voiceOf(s.spoken),
        // Typed, or corrected after the mic wrote it: what the customer reads.
        text: s.typed?.trim() ? s.typed.trim() : null,
      })),
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

  if (sentRef) return <Posted clientRef={sentRef} c={c} t={t} local={{ photos: posted.length, crew: crew.size + newcomers.length, ticked: ticks.length }} />;

  const langName = t(`lang.${c.customerLang}`);
  const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const locale = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  const dateLine = new Date().toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  /* The steps, in plan order, under "Stage · Group" headings. */
  const groups: { head: string; items: PostContext['items'] }[] = [];
  for (const it of openItems) {
    const head = `${it.stage} · ${it.group}`;
    const last = groups[groups.length - 1];
    if (last && last.head === head) last.items.push(it);
    else groups.push({ head, items: [it] });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <div className="st-backhead">
        <Link href="/studio/site" aria-label={t('post.back')}>
          <BackIcon />
        </Link>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1>{t('post.h1')}</h1>
          <span className="sub">
            {c.home} · {dateLine}
          </span>
        </div>
      </div>

      <div className="st-page" style={{ flex: 1, paddingTop: 8, gap: 12 }}>
        {c.today ? (
          <p className="st-info">
            {t('post.adding', { time: new Date(c.today.postedAt).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }), customer: c.customerFirst })}
          </p>
        ) : null}

        {/* 1 · Photos */}
        <section aria-labelledby="h-photos" className="st-sec">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <h2 id="h-photos">{t('s1.h')}</h2>
            <span className="hint">{t('s1.sub')}</span>
          </div>

          {generalShots.map((s, i) => (
            <div key={s.key} className="st-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={t('photo.n', { n: i + 1 })} />
              <div className="body">
                <div className="st-meta" style={{ justifyContent: 'space-between' }}>
                  <span className="room">
                    {s.room ?? t('photo.n', { n: i + 1 })} · <span className="mono">{time(s.takenAt)}</span>
                  </span>
                  <button type="button" onClick={() => removeShot(s.key)} className="st-link" style={{ minHeight: 32, fontSize: 13 }}>
                    {t('photo.remove')}
                  </button>
                </div>
                {s.fromGallery ? <span className="st-warn">{t('photo.galleryTag')}</span> : null}
                {c.rooms.length ? (
                  <div role="group" aria-label={t('photo.room')} className="st-scroll">
                    {c.rooms.map((room) => (
                      <button key={room} type="button" aria-pressed={s.room === room} onClick={() => setRoom(s.key, s.room === room ? null : room)} className="st-chip sm" style={{ minHeight: 34, fontSize: 13, background: s.room === room ? undefined : 'var(--paper)' }}>
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
            <div role="status" className="st-toast">
              <span>{t('photo.removed')}</span>
              <button
                type="button"
                onClick={() => {
                  setShots((list) => [...list.filter((s) => !removed.shot.stepId || s.stepId !== removed.shot.stepId), removed.shot]);
                  setRemoved(null);
                }}
              >
                {t('undo')}
              </button>
            </div>
          ) : null}

          {generalShots.length === 0 ? <span className="hint">{t('photo.corner')}</span> : null}
          <div className="st-two" style={{ gap: 8 }}>
            <button type="button" onClick={() => pickPhoto(null, 'camera')} disabled={busyPhoto !== null || shots.length >= MAX_SHOTS} className="st-big" style={{ minHeight: 52, fontSize: 15, borderRadius: 14 }}>
              <CameraIcon size={20} />
              {busyPhoto === OTHER ? t('photo.working') : generalShots.length === 0 ? t('photo.first') : t('photo.another')}
            </button>
            <button type="button" onClick={() => pickPhoto(null, 'gallery')} disabled={busyPhoto !== null || shots.length >= MAX_SHOTS} className="st-fill">
              <GalleryIcon size={20} />
              {t('photo.gallery')}
            </button>
          </div>
          {photoError ? <p className="st-bad-t" style={{ margin: 0, fontSize: 14 }}>{t('photo.bad')}</p> : null}
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void addFiles(e.target.files, false).then(() => (e.target.value = ''))} />
          <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={(e) => void addFiles(e.target.files, true).then(() => (e.target.value = ''))} />

          <Mic spoken={other} recording={recordingKey === OTHER} blocked={recordingKey !== null && recordingKey !== OTHER} onTap={() => tapMic(OTHER)} label={t('mic.other')} t={t} c={c} quiet />
          {recorder.state.status === 'denied' || recorder.state.status === 'unsupported' ? <p className="st-bad-t" style={{ margin: 0, fontSize: 14 }}>{t('mic.denied')}</p> : null}
        </section>

        {/* 2 · Crew */}
        <section aria-labelledby="h-crew" className="st-sec">
          <h2 id="h-crew">{t('s2.h')}</h2>
          {c.crew.length === 0 && newcomers.length === 0 ? <span className="hint">{t('crew.none')}</span> : null}
          <div role="group" aria-labelledby="h-crew" className="st-chips">
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
                  className="st-chip"
                >
                  {on ? <CheckIcon /> : null}
                  {m.name} · {m.role}
                </button>
              );
            })}
            {newcomers.map((n, i) => (
              <button key={`new-${i}`} type="button" aria-pressed onClick={() => setNewcomers((list) => list.filter((_, j) => j !== i))} className="st-chip">
                <CheckIcon />
                {n.name} · {t(`role.${n.role as (typeof CREW_ROLES)[number]}`)}
              </button>
            ))}
            <AddCrew t={t} canSave={c.canSaveCrew} onAdd={(n) => setNewcomers((list) => [...list, n])} />
          </div>
          {crew.size + newcomers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="hint" style={{ fontSize: 14 }}>
                {t('crew.since')}
              </span>
              <div role="radiogroup" aria-label={t('crew.since')} className="st-chips">
                {SINCE.map((hhmm) => (
                  <button key={hhmm} type="button" role="radio" aria-checked={since === hhmm} onClick={() => setSince(since === hhmm ? null : hhmm)} className="st-chip sm mono">
                    {Number(hhmm.slice(0, 2)) > 12 ? `${Number(hhmm.slice(0, 2)) - 12} pm` : `${Number(hhmm.slice(0, 2))} ${hhmm === '12:00' ? 'pm' : 'am'}`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* 3 · What got done: each ticked step gets its own photo and sentence */}
        <section aria-labelledby="h-done" className="st-sec" style={{ gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <h2 id="h-done">{t('s3.h')}</h2>
            {openItems.length && c.canTick ? <span className="hint">{t('s3.sub')}</span> : null}
          </div>
          {openItems.length === 0 ? <span className="hint">{t('s3.none')}</span> : null}
          {c.canTick
            ? groups.map((g) => (
                <div key={g.head} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="st-group">{g.head}</span>
                  {g.items.map((item) => {
                    const on = isOn(item.id);
                    const fromVoice = on && !(item.id in manual) && suggested.has(item.id);
                    const shot = on ? stepShot(item.id) : null;
                    return (
                      <div key={item.id} className={`st-step${on ? ' on' : ''}`}>
                        <button type="button" role="checkbox" aria-checked={on} onClick={() => setManual((m) => ({ ...m, [item.id]: !on }))} className="st-tick">
                          <span aria-hidden="true" className="box">
                            {on ? <CheckIcon size={16} /> : null}
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 15, fontWeight: 500 }}>{item.label}</span>
                            {fromVoice ? (
                              <span style={{ fontSize: 13, color: 'var(--good)' }}>{t('tick.voice')}</span>
                            ) : null}
                          </span>
                        </button>
                        {on ? (
                          <StepSlot
                            shot={shot}
                            busy={busyPhoto === item.id}
                            // A new photo cannot go past the post's 12; a step that has one may retake it.
                            blocked={(busyPhoto !== null && busyPhoto !== item.id) || (!shot && shots.length >= MAX_SHOTS)}
                            recordingKey={recordingKey}
                            onCamera={() => pickPhoto(item.id, 'camera')}
                            onGallery={() => pickPhoto(item.id, 'gallery')}
                            onRemove={() => shot && removeShot(shot.key)}
                            onMic={() => shot && tapMic(shot.key)}
                            onTyped={(v) => shot && setTyped(shot.key, v)}
                            t={t}
                            c={c}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))
            : null}
          {doneItems.length ? (
            <span className="hint">
              {t('tick.earlier')}: {doneItems.length}
            </span>
          ) : null}
        </section>

        {/* 4 · Preview */}
        <section aria-labelledby="h-reads" className="st-sec" style={{ gap: 8 }}>
          <span id="h-reads" className="st-reads">
            <EyeIcon size={15} />
            {t('s4.h', { customer: c.customerFirst, lang: langName })}
          </span>
          {sentences.length || onItems.length ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sentences.map((s, i) => (
                <li key={`s-${i}`} style={{ fontSize: 15, lineHeight: 1.45 }}>
                  {s}
                </li>
              ))}
              {onItems.map((item) => {
                const shot = stepShot(item.id);
                const said = shot ? sentenceOf(shot) : '';
                return (
                  <li key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>
                      {t('step.done', { step: item.label })}
                      {shot ? <span className="st-line" style={{ fontWeight: 400 }}> · {time(shot.takenAt)}</span> : null}
                    </span>
                    <span style={{ fontSize: 15, lineHeight: 1.45, color: said ? undefined : 'var(--muted)' }}>{said || (shot?.spoken.status === 'offline' ? t('mic.offline') : t('step.need1'))}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="st-line" style={{ margin: 0, fontSize: 15 }}>
              {t('s4.empty')}
            </p>
          )}
          <span className="hint">{t('s4.note')}</span>
        </section>
      </div>

      <div className="st-bottom">
        {countdown !== null ? (
          <div className="row">
            <span role="status" className="st-info" style={{ flex: 1, minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
              {t('post.posting', { s: countdown })}
            </span>
            <button type="button" onClick={() => setCountdown(null)} className="st-fill" style={{ minHeight: 60, padding: '0 20px' }}>
              {t('undo')}
            </button>
          </div>
        ) : (
          <button type="button" disabled={!canPost} onClick={() => setCountdown(UNDO_MS / 1000)} className="st-big pill">
            {!online ? <CloudIcon /> : null}
            {missing.length ? t('step.need', { n: missing.length }) : !hasSomething ? t('post.needPhoto') : t('post.btn')}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Under a ticked step: its own photo, the sentence the customer reads under
 * it (typed, or said into its mic and corrected here), and the customer's
 * "Done: {step}" line in the preview below.
 */
function StepSlot({
  shot,
  busy,
  blocked,
  recordingKey,
  onCamera,
  onGallery,
  onRemove,
  onMic,
  onTyped,
  t,
  c,
}: {
  shot: Shot | null;
  busy: boolean;
  blocked: boolean;
  recordingKey: string | null;
  onCamera: () => void;
  onGallery: () => void;
  onRemove: () => void;
  onMic: () => void;
  onTyped: (v: string) => void;
  t: SiteT;
  c: PostContext;
}) {
  if (!shot) {
    return (
      <div className="st-slot">
        <span className="hint" style={{ fontSize: 14, color: 'var(--text2)' }}>
          {t('step.photo')}
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          <button type="button" onClick={onCamera} disabled={busy || blocked} className="st-big" style={{ minHeight: 52, fontSize: 15, borderRadius: 14 }}>
            <CameraIcon size={20} />
            {busy ? t('photo.working') : t('step.take')}
          </button>
          <button type="button" onClick={onGallery} disabled={busy || blocked} className="st-fill">
            <GalleryIcon size={20} />
            {t('photo.gallery')}
          </button>
        </div>
      </div>
    );
  }
  const value = shot.typed ?? shot.spoken.customerText ?? '';
  return (
    <div className="st-slot">
      <div className="st-photo" style={{ background: 'transparent', padding: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.url} alt="" />
        <div className="body">
          {shot.fromGallery ? <span className="st-warn">{t('photo.galleryTag')}</span> : null}
          <div className="st-meta">
            <button type="button" onClick={onCamera} disabled={busy || blocked} className="st-redo" style={{ background: 'var(--fill)' }}>
              {t('step.retake')}
            </button>
            <button type="button" onClick={onRemove} className="st-redo" style={{ background: 'var(--fill)' }}>
              {t('photo.remove')}
            </button>
          </div>
        </div>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>
        {t('step.sentence', { customer: c.customerFirst })}
        <textarea rows={2} maxLength={300} value={value} onChange={(e) => onTyped(e.target.value)} placeholder={t('step.sentencePh')} className="st-textarea" />
      </label>
      <Mic spoken={shot.spoken} recording={recordingKey === shot.key} blocked={recordingKey !== null && recordingKey !== shot.key} onTap={onMic} label={t('step.say')} t={t} c={c} quiet />
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
      <button type="button" onClick={onTap} className={`st-mic rec${quiet ? ' wide' : ''}`}>
        <span aria-hidden="true">
          <StopIcon size={16} />
        </span>
        {t('mic.stop')}
      </button>
    );
  }
  if (s.status === 'none') {
    return quiet ? (
      <button type="button" onClick={onTap} disabled={blocked} className="st-fill">
        <MicIcon size={18} />
        {label}
      </button>
    ) : (
      <button type="button" onClick={onTap} disabled={blocked} className="st-mic">
        <span aria-hidden="true">
          <MicIcon size={16} />
        </span>
        {label}
      </button>
    );
  }
  return (
    <div className="st-said-box" style={quiet ? undefined : { padding: 0, background: 'transparent' }}>
      {quiet ? <span className="st-label">{label}</span> : null}
      {s.status === 'working' ? <span className="st-heard">{t('mic.working')}</span> : null}
      {s.status === 'offline' ? <span className="st-heard">{t('mic.offline')}</span> : null}
      {s.status === 'off' || s.status === 'error' ? <span className="st-heard">{t('mic.off')}</span> : null}
      {s.status === 'done' ? (
        <>
          <span className="st-heard">
            &ldquo;{s.transcript}&rdquo;{s.sample ? ` · ${t('mic.sample')}` : ''}
          </span>
          <span className="st-hint">{t('mic.reads', { customer: c.customerFirst })}</span>
          <span className="st-said">{s.customerText}</span>
        </>
      ) : null}
      <div className="st-meta">
        <span className="mono">{s.seconds ? `0:${String(s.seconds).padStart(2, '0')}` : ''}</span>
        <button type="button" onClick={onTap} disabled={blocked || s.status === 'working'} className="st-redo">
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
      <button type="button" onClick={() => setOpen(true)} className="st-chip add">
        {t('crew.add')}
      </button>
    );
  }
  return (
    <div className="st-said-box" style={{ width: '100%', gap: 10 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--muted)' }}>
        {t('crew.name')}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" className="st-input" />
      </label>
      <div role="radiogroup" aria-label={t('crew.role')} className="st-chips">
        {CREW_ROLES.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)} className="st-chip sm" style={role === r ? undefined : { background: 'var(--paper)' }}>
            {t(`role.${r}`)}
          </button>
        ))}
      </div>
      {canSave ? (
        <label style={{ display: 'flex', minHeight: 44, alignItems: 'center', gap: 10, fontSize: 15 }}>
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} style={{ width: 24, height: 24, accentColor: 'var(--acc)' }} />
          {t('crew.keep')}
        </label>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
        <button
          type="button"
          disabled={name.trim().length < 2}
          onClick={() => {
            onAdd({ name: name.trim(), role, save: canSave && keep });
            setName('');
            setOpen(false);
          }}
          className="st-big"
          style={{ minHeight: 52, fontSize: 16, borderRadius: 14 }}
        >
          {t('crew.save')}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="st-link">
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
    <div className="st-page" style={{ padding: '40px 20px', gap: 22 }}>
      <span aria-hidden="true" className="st-done-mark" style={{ background: sent ? 'var(--good-s)' : failed ? 'var(--bad-s)' : 'var(--warn-s)' }}>
        {sent ? <CheckIcon size={30} /> : <CloudIcon size={30} />}
      </span>
      <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="st-h2big">{sent ? t('done.sent.h', { customer: c.customerFirst }) : t('done.saved.h')}</h2>
        <p className="st-line" style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>
          {failed
            ? t('queue.failed', { error: errorWords(t, p?.error ?? undefined) })
            : sent
              ? `${t('done.line', { photos: r?.photos ?? local.photos, crew: r?.crew ?? local.crew, ticked: r?.ticked ?? local.ticked })}${r?.stage ? ` · ${r.stage}` : ''}.`
              : `${p?.status === 'sending' ? t('queue.sending') : t('queue.waiting')}. ${t('done.saved.p', { customer: c.customerFirst })}`}
        </p>
      </div>
      <div className="st-sec" style={{ gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{t('done.where', { customer: c.customerFirst })}</span>
        <span style={{ fontSize: 15 }}>{t('done.where2')}</span>
        <span className="hint">{t('done.fix')}</span>
      </div>
      <Link href="/studio/site" className="st-big pill">
        {t('post.back')}
      </Link>
    </div>
  );
}
