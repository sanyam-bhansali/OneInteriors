'use client';

/**
 * GEIO (the owner's v1 screens, GEIO 1–4): an interior expert to ask about
 * your own home, in English, Hindi or Marathi — by typing, speaking, or
 * sending a photo — that hands anything about money or judgement to a person.
 *
 * Answers come from the model through `askGeioAction`, checked on the server.
 * Where the model is not available (no key on this deployment, or a failed
 * call) the screen answers from the written examples in `geio-script.ts` and
 * says "Preview" on them.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CameraIcon, Chevron, Frame, MicIcon, SendIcon, useBrief } from '@/components/app/ui';
import { TODAY } from '@/modules/app/example-project';
import { STYLE_LABELS } from '@/modules/brief/types';
import { TIER } from '@/modules/quotation/tiers';
import { GREETING, SUGGESTIONS, answerFor, partOfDay, topicOf } from '@/modules/app/geio-script';
import type { GeioReply } from '@/modules/app/geio';
import { askGeioAction } from './actions';

type Lang = keyof typeof GREETING;

interface Turn {
  ask: string;
  /** A data: URL of their photo, or an example frame in the preview. */
  pic?: string;
  /** Null while GEIO is thinking. */
  reply: GeioReply | null;
  live: boolean;
  /** Show today's site photos under the answer. */
  site: boolean;
}

const LANGS: { id: Lang; label: string; speech: string }[] = [
  { id: 'en', label: 'English', speech: 'en-IN' },
  { id: 'hi', label: 'हिंदी', speech: 'hi-IN' },
  { id: 'mr', label: 'मराठी', speech: 'mr-IN' },
];

const PHOTO_SIDE = 1024;

/** Their photo, shrunk to at most 1024 px on its long side, as a JPEG data: URL. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.8);
}

function preview(question: string, name: string, expert: string, pic: boolean): GeioReply {
  // A written answer cannot be about a photo it has not seen, so a photo goes to a person.
  if (pic) {
    return {
      paragraphs: [
        `I can’t look at photos in this build, so I’ve passed yours to ${expert}. She will tell you whether it needs the studio’s attention.`,
      ],
      see: [],
      handover: `${name} sent a photo and asked: “${question.slice(0, 200)}”`,
      follow: [],
      sources: [],
    };
  }
  const a = answerFor(topicOf(question), name, expert, question);
  return {
    paragraphs: a.paragraphs,
    see: (a.see ?? []).map((s) => ({ ...s, watch: Boolean(s.watch) })),
    handover: a.handover ?? null,
    follow: a.follow ?? [],
    sources: [],
  };
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
};

/**
 * An answer arriving the way the design shows it: one paragraph at a time
 * with a cursor, then the cards under it. Older answers are already whole.
 */
function Reveal({ paragraphs, children }: { paragraphs: string[]; children: ReactNode }) {
  const [shown, setShown] = useState(1);
  useEffect(() => {
    if (shown >= paragraphs.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 700);
    return () => clearTimeout(t);
  }, [shown, paragraphs.length]);
  const done = shown >= paragraphs.length;
  return (
    <>
      {paragraphs.slice(0, shown).map((p) => (
        <p key={p} className="oa-para">
          {p}
        </p>
      ))}
      {done ? <div className="oa-later">{children}</div> : <span className="oa-caret" aria-hidden />}
    </>
  );
}

const SUGGEST_ICON: Record<string, ReactNode> = {
  site: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  photo: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  price: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12M6 9h12M13 21 6 13h3a4 4 0 0 0 0-9" />
    </svg>
  ),
};

function Headset() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3.5" y="13" width="4" height="6" rx="1.5" />
      <rect x="16.5" y="13" width="4" height="6" rx="1.5" />
    </svg>
  );
}

export function GeioScreen({ back, expert, startWithExpert }: { back: string; expert: string; startWithExpert: boolean }) {
  const router = useRouter();
  const [brief] = useBrief();
  const name = brief?.contactName?.trim() || 'Priya';
  const [lang, setLang] = useState<Lang>('en');
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [part, setPart] = useState('evening');
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const recognition = useRef<Recognition | null>(null);
  const started = useRef(false);

  const busy = turns.some((t) => t.reply === null);

  useEffect(() => {
    setPart(partOfDay(new Date().getHours()));
    const w = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    setCanSpeak(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);
  useEffect(() => {
    if (turns.length) end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const ask = async (q: string, pic?: string) => {
    const question = q.trim() || (pic ? 'Is this normal?' : '');
    if (!question || busy) return;
    setText('');
    setNote(null);
    const history = turns
      .filter((t) => t.reply)
      .flatMap((t) => [
        { role: 'user', text: t.ask },
        { role: 'assistant', text: t.reply!.paragraphs.join('\n\n') },
      ]);
    const turn: Turn = {
      ask: question,
      pic,
      reply: null,
      live: false,
      site: !pic && topicOf(question) === 'site',
    };
    setTurns((all) => [...all, turn]);

    let reply: GeioReply;
    let wasLive = false;
    try {
      const res = await askGeioAction({
        question,
        history,
        image: pic?.startsWith('data:') ? pic : undefined,
        lang,
        name,
      });
      if (res.ok) {
        reply = res.reply;
        wasLive = true;
      } else {
        if (res.reason === 'busy') setNote('That was a lot of questions at once. Wait a few minutes, or ask your expert.');
        reply = preview(question, name, expert, Boolean(pic));
      }
    } catch {
      reply = preview(question, name, expert, Boolean(pic));
    }
    setTurns((all) => all.map((t) => (t === turn ? { ...t, reply, live: wasLive } : t)));
  };

  useEffect(() => {
    if (!startWithExpert || started.current) return;
    started.current = true;
    void ask(`I’m not sure which shutter finish to pick. Can I talk to ${expert}?`);
    // Once, on arrival from "Ask the expert".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      await ask(text, await shrink(f));
    } catch {
      setNote('That photo could not be read. Try another, or a screenshot of it.');
    }
  };

  const speak = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const R = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!R) return;
    const r = new R();
    r.lang = LANGS.find((l) => l.id === lang)!.speech;
    r.interimResults = true;
    r.onresult = (e) => setText(Array.from(e.results, (x) => x[0]!.transcript).join(' '));
    r.onend = () => setListening(false);
    recognition.current = r;
    setListening(true);
    r.start();
  };

  const g = GREETING[lang];
  const context = [
    '2 BHK, Baner',
    brief?.tier ? TIER[brief.tier].label : 'Premium',
    brief?.styleLikes?.[0] ? STYLE_LABELS[brief.styleLikes[0]] : 'Warm modern',
  ];

  return (
    <Frame>
      <div className="oa-aura-box" aria-hidden>
        <div className={`oa-aura${listening ? ' hot' : turns.length ? ' quiet' : ''}`} />
      </div>
      <header className="oa-geio-head">
        <button type="button" className="oa-geio-back" aria-label="Back" onClick={() => router.push(back)}>
          <Chevron />
        </button>
        <span className="who">
          <span className={`oa-orb small${busy ? ' busy' : ''}`} aria-hidden />
          GEIO
        </span>
        <button
          type="button"
          className="oa-pill"
          style={{
            background: 'var(--ink)',
            color: '#fff',
            borderColor: 'var(--ink)',
          }}
          onClick={() => void ask(`Can I talk to ${expert}?`)}
        >
          <Headset />
          {expert}
        </button>
      </header>

      <main className="oa-body" style={{ paddingBottom: 8 }}>
        {turns.length === 0 ? (
          <>
            <span className="oa-orb big" aria-hidden />
            <h1 className="oa-title">
              <span className="oa-grad">{g.hello(part, name)}</span>
              <br />
              {g.ask}
            </h1>
            <p className="oa-sub" style={{ margin: 0 }}>
              I&rsquo;m GEIO, your interior design expert. Ask me anything about your home.
            </p>
            <div className="oa-geio-langs" role="group" aria-label="Language">
              {LANGS.map((l) => (
                <button key={l.id} type="button" aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
            <div className="oa-geio-context" aria-label="What GEIO knows about your home">
              {context.map((c) => (
                <span key={c}>{c}</span>
              ))}
              <span className="now">Carpentry, day 18</span>
            </div>
            <div className="oa-suggest">
              {SUGGESTIONS.map((sg) => (
                <button
                  key={sg.topic}
                  type="button"
                  onClick={() => (sg.topic === 'photo' ? file.current?.click() : void ask(sg.ask))}
                >
                  {sg.topic === 'photo' ? 'Is this crack normal? Send a photo' : sg.ask}
                  <span className="icon" aria-hidden>
                    {SUGGEST_ICON[sg.topic]}
                  </span>
                </button>
              ))}
              <button type="button" onClick={() => void ask(`Can I talk to ${expert}?`)}>
                Talk to {expert}, your expert
                <span className="icon" aria-hidden>
                  <Headset />
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="oa-chat">
            {turns.map((t, i) => (
              <div key={i} className="oa-chat">
                {t.pic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="oa-msg-photo" src={t.pic} alt="Your photo" />
                ) : null}
                <div className="oa-msg-me">{t.ask}</div>
                <div className="oa-msg-ai">
                  <span className={`oa-orb${t.reply === null ? ' busy' : ''}`} aria-hidden />
                  <div className="text">
                    {t.reply === null ? (
                      <p className="oa-think" aria-live="polite">
                        {t.pic ? 'Looking at your photo…' : 'Checking your project…'}
                      </p>
                    ) : (
                      <Reveal paragraphs={t.reply.paragraphs}>
                        {t.site ? (
                          <Link
                            href="/app/site"
                            className="oa-card"
                            style={{
                              display: 'block',
                              padding: 0,
                              overflow: 'hidden',
                              textDecoration: 'none',
                            }}
                          >
                            <span className="oa-thumbs" style={{ gap: 2 }}>
                              {TODAY.map((ph) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img key={ph.src} src={ph.src} alt={ph.alt} style={{ borderRadius: 0 }} />
                                ))}
                            </span>
                            <b
                              style={{
                                display: 'block',
                                padding: '12px 14px',
                                fontSize: 14.5,
                              }}
                            >
                              Today&rsquo;s site update, 9:40 am →
                            </b>
                          </Link>
                        ) : null}
                        {t.reply.sources?.length ? <Sources sources={t.reply.sources} /> : null}
                        {t.reply.see.length ? (
                          <div className="oa-card">
                            <span className="oa-meta">What I see</span>
                            <ul className="oa-see">
                              {t.reply.see.map((s) => (
                                <li key={s.what} className={s.watch ? 'watch' : ''}>
                                  <span>{s.what}</span>
                                  <span>{s.verdict}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {t.reply.handover ? (
                          <div className="oa-card">
                            <div className="flex items-center gap-3">
                              <span
                                className="oa-avatar"
                                style={{
                                  background: 'var(--ok)',
                                  color: '#fff',
                                }}
                                aria-hidden
                              >
                                {expert.charAt(0)}
                              </span>
                              <span>
                                <b style={{ display: 'block', fontSize: 16 }}>{expert}, your One Interiors expert</b>
                                <span style={{ fontSize: 13, color: 'var(--ok)' }}>● Replies Tue–Sun, 11 am to 7 pm</span>
                              </span>
                            </div>
                            <div className="mt-3 rounded-[14px] p-3" style={{ background: 'var(--bg)' }}>
                              <span className="oa-meta">GEIO passed this to {expert}</span>
                              <p
                                style={{
                                  margin: '6px 0 0',
                                  fontSize: 14.5,
                                  lineHeight: 1.45,
                                }}
                              >
                                {t.reply.handover}
                              </p>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <Link href="/app/expert" className="oa-cta black" style={{ minHeight: 46, padding: '0 14px' }}>
                                Call
                              </Link>
                              <button
                                type="button"
                                className="oa-cta"
                                style={{ minHeight: 46, padding: '0 14px' }}
                                disabled
                                title="Not built yet: nothing is sent"
                              >
                                Chat here
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {!t.live ? <p className="oa-sample">Preview · a written example, not a live answer</p> : null}
                        {t.reply.follow.length && i === turns.length - 1 ? (
                          <div className="oa-chips mt-3">
                            {t.reply.follow.map((f) => (
                              <button key={f} type="button" className="oa-chip" onClick={() => void ask(f)}>
                                {f}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </Reveal>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
        )}
        {note ? (
          <p className="oa-note" role="status">
            {note}
          </p>
        ) : null}
      </main>

      <form
        className="oa-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(text);
        }}
      >
        <input
          ref={file}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            void pickPhoto(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div className="box">
          <button
            type="button"
            className="oa-icon-btn"
            aria-label="Send a photo"
            onClick={() => file.current?.click()}
            disabled={busy}
          >
            <CameraIcon />
          </button>
          <input
            aria-label="Ask GEIO"
            placeholder={listening ? 'Listening…' : turns.length ? 'Ask GEIO anything' : g.placeholder}
            value={text}
            maxLength={600}
            onChange={(e) => setText(e.target.value)}
          />
          {listening ? (
            <span className="oa-wave" aria-hidden>
              {[18, 26, 30, 22, 28, 16, 24].map((h, i) => (
                <span key={i} style={{ height: h, animationDelay: `${i * 0.12}s` }} />
              ))}
            </span>
          ) : null}
          {canSpeak ? (
            <button
              type="button"
              className={`oa-icon-btn${listening ? ' listening' : ''}`}
              aria-label={listening ? 'Stop listening' : 'Speak'}
              aria-pressed={listening}
              onClick={speak}
            >
              <MicIcon />
            </button>
          ) : null}
          <button type="submit" className="oa-icon-btn send" aria-label="Send" disabled={!text.trim() || busy}>
            <SendIcon />
          </button>
        </div>
        <p>GEIO can make mistakes. Prices and dates are confirmed by your studio.</p>
      </form>
    </Frame>
  );
}

/**
 * Where the figures came from (trust fix 8): a tag per quote line GEIO used,
 * each checked on the server to exist. Tapping one opens the line itself, so
 * the homeowner can check the number without leaving the answer.
 */
function Sources({ sources }: { sources: NonNullable<GeioReply['sources']> }) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = sources.find((s) => s.line === open) ?? null;
  return (
    <div className="oa-sources">
      <span className="oa-label" style={{ margin: 0 }}>
        From your quote
      </span>
      <div className="tags">
        {sources.map((s) => (
          <button key={s.line} type="button" aria-expanded={open === s.line} onClick={() => setOpen(open === s.line ? null : s.line)}>
            Line {s.line} · {s.item}
          </button>
        ))}
      </div>
      {shown ? (
        <div className="line" role="note">
          <b>
            Line {shown.line}, {shown.item}
          </b>
          <span className="amt">{shown.amount}</span>
          <small>{shown.spec}</small>
        </div>
      ) : null}
    </div>
  );
}
