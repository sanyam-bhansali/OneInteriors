'use client';

/**
 * GEIO (the owner's v1 screens, GEIO 1–4): an interior expert to ask about
 * your own home, in English, Hindi or Marathi, that hands anything about
 * money or judgement to a person.
 *
 * Preview: the answers are written out in `geio-script.ts`, not generated,
 * and the screen says so.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CameraIcon, Chevron, Frame, MicIcon, SendIcon, useBrief } from '@/components/app/ui';
import { photo } from '@/modules/app/example-project';
import { GREETING, SUGGESTIONS, answerFor, partOfDay, topicOf, type GeioTopic } from '@/modules/app/geio-script';

type Lang = keyof typeof GREETING;
interface Turn {
  ask: string;
  topic: GeioTopic;
  photo?: number;
}

const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिंदी' },
  { id: 'mr', label: 'मराठी' },
];

function Headset() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
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
  const [turns, setTurns] = useState<Turn[]>(() =>
    startWithExpert ? [{ ask: 'I’m not sure which shutter finish to pick. Can I talk to someone?', topic: 'other' }] : [],
  );
  const [part, setPart] = useState('evening');
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPart(partOfDay(new Date().getHours()));
  }, []);
  useEffect(() => {
    if (turns.length) end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const ask = (q: string, topic?: GeioTopic) => {
    const question = q.trim();
    if (!question) return;
    const t = topic ?? topicOf(question);
    setTurns((all) => [...all, { ask: question, topic: t, photo: t === 'photo' ? 30 : undefined }]);
    setText('');
  };

  const g = GREETING[lang];

  return (
    <Frame>
      <header className="oa-geio-head">
        <button type="button" className="oa-back" aria-label="Back" onClick={() => router.push(back)} style={{ marginLeft: 0 }}>
          <Chevron />
        </button>
        <span className="who">
          <span className="oa-orb" aria-hidden />
          <span>
            GEIO
            <small>Preview</small>
          </span>
        </span>
        <button type="button" className="oa-pill" style={{ background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }} onClick={() => ask(`Can I talk to ${expert}?`, 'other')}>
          <Headset />
          {expert}
        </button>
      </header>

      <main className="oa-body" style={{ paddingBottom: 8 }}>
        {turns.length === 0 ? (
          <>
            <span className="oa-orb big" aria-hidden />
            <h1 className="oa-title">
              <span style={{ color: 'var(--accent)' }}>{g.hello(part, name)}</span>
              <br />
              {g.ask}
            </h1>
            <p className="oa-sub" style={{ margin: 0 }}>
              I&rsquo;m GEIO, your interior design expert. Ask me anything about your home.
            </p>
            <div className="oa-chips">
              {LANGS.map((l) => (
                <button key={l.id} type="button" className="oa-chip" aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
            <div className="oa-chips">
              {['2 BHK, Baner', 'Premium', 'Warm modern'].map((c) => (
                <span key={c} className="oa-chip small" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default' }}>
                  {c}
                </span>
              ))}
              <span className="oa-chip small" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default', color: 'var(--accent-ink)' }}>
                Carpentry, day 18
              </span>
            </div>
            <div className="oa-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s.topic} type="button" onClick={() => ask(s.ask, s.topic)}>
                  <small>{s.label}</small>
                  {s.ask}
                </button>
              ))}
              <button type="button" onClick={() => ask(`Can I talk to ${expert}?`, 'other')}>
                <small>A person</small>
                Talk to {expert}, your expert
              </button>
            </div>
            {lang !== 'en' ? <p className="oa-note">Preview: the written answers are in English for now.</p> : null}
          </>
        ) : (
          <div className="oa-chat">
            {turns.map((t, i) => {
              const a = answerFor(t.topic, name, expert, t.ask);
              return (
                <div key={i} className="oa-chat">
                  <div className="oa-msg-me">
                    {t.photo !== undefined ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo(t.photo)} alt="Your photo" />
                    ) : null}
                    {t.photo !== undefined ? 'Is this normal?' : t.ask}
                  </div>
                  <div className="oa-msg-ai">
                    <span className="oa-orb" aria-hidden />
                    <div className="text">
                      {a.paragraphs.map((p) => (
                        <p key={p}>{p}</p>
                      ))}
                      {a.photos ? (
                        <Link href="/app/site" className="oa-card" style={{ display: 'block', padding: 0, overflow: 'hidden', textDecoration: 'none' }}>
                          <span className="oa-thumbs" style={{ gap: 2 }}>
                            {a.photos.map((f) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={f} src={photo(f)} alt="" style={{ borderRadius: 0 }} />
                            ))}
                          </span>
                          <b style={{ display: 'block', padding: '12px 14px', fontSize: 14.5 }}>{a.photosCaption} →</b>
                        </Link>
                      ) : null}
                      {a.see ? (
                        <div className="oa-card">
                          <span className="oa-meta">What I see</span>
                          <ul className="oa-see">
                            {a.see.map((s) => (
                              <li key={s.what} className={s.watch ? 'watch' : ''}>
                                <span>{s.what}</span>
                                <span>{s.verdict}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {a.handover ? (
                        <div className="oa-card">
                          <div className="flex items-center gap-3">
                            <span className="oa-avatar" style={{ background: 'var(--ok)', color: '#fff' }} aria-hidden>
                              {expert.charAt(0)}
                            </span>
                            <span>
                              <b style={{ display: 'block', fontSize: 16 }}>{expert}, your One Interiors expert</b>
                              <span style={{ fontSize: 13, color: 'var(--ok)' }}>● Replies Tue–Sun, 11 am to 7 pm</span>
                            </span>
                          </div>
                          <div className="mt-3 rounded-[14px] p-3" style={{ background: 'var(--bg)' }}>
                            <span className="oa-meta">GEIO passed this to {expert}</span>
                            <p style={{ margin: '6px 0 0', fontSize: 14.5, lineHeight: 1.45 }}>{a.handover}</p>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Link href="/app/expert" className="oa-cta black" style={{ minHeight: 46, padding: '0 14px' }}>
                              Call
                            </Link>
                            <button type="button" className="oa-cta" style={{ minHeight: 46, padding: '0 14px' }} disabled title="Preview: nothing is sent">
                              Chat here
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {a.follow && i === turns.length - 1 ? (
                        <div className="oa-chips mt-3">
                          {a.follow.map((f) => (
                            <button key={f} type="button" className="oa-chip" onClick={() => ask(f)}>
                              {f}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={end} />
          </div>
        )}
      </main>

      <form
        className="oa-composer"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <div className="box">
          <button type="button" className="oa-icon-btn" aria-label="Send a photo" onClick={() => ask('Is this normal?', 'photo')}>
            <CameraIcon />
          </button>
          <input
            aria-label="Ask GEIO"
            placeholder={turns.length ? 'Ask GEIO anything' : g.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="button" className="oa-icon-btn" aria-label="Speak (not in the preview)" disabled>
            <MicIcon />
          </button>
          <button type="submit" className="oa-icon-btn send" aria-label="Send" disabled={!text.trim()}>
            <SendIcon />
          </button>
        </div>
        <p>Preview answers are written examples. GEIO can make mistakes; prices and dates are confirmed by your studio.</p>
      </form>
    </Frame>
  );
}
