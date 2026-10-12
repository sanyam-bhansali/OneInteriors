'use client';

/**
 * The studio sign-in, one flow in four steps (the owner's UI handoff:
 * StudioSignInWeb at 1440, StudioSignIn at 390):
 *
 * 1. **Who's signing in?** Sales, Designer, Project manager, Owner / admin,
 *    or "On site today?" (a site supervisor, straight to mobile).
 * 2. **Email or mobile.** Mobile is our studio phone code; email opens the
 *    email sign-in owners already have (/sign-in). No new provider.
 * 3. **The 6-digit code**, typed, pasted whole or filled from the
 *    notification; it submits on the sixth digit. On this laptop the code is
 *    shown on the page (local development only, `studioDevCode`).
 * 4. **Welcome back, {name}** with what is waiting, then their home.
 *
 * The picked role goes to the server only to be compared with the team
 * list. When they differ, the yellow card says so; "Sign in as {real}"
 * carries on to the real role's home and "Pick again" signs out and starts
 * over. Where anyone lands is always their real role's home.
 *
 * After sign-in it navigates with a full page load, not the router: the
 * studio layout decides who sees which screen, and a client-side navigation
 * would keep the signed-out frame around it.
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { normalisePhone } from '@/modules/studio/phone';
import { LANGS, tx, type Lang } from '@/modules/i18n/site';
import { STUDIO_LANG_LABEL, STUDIO_WORDS, type StudioWord } from '@/modules/i18n/studio';
import { setLang as keepLang } from '@/components/app/i18n';
import type { StudioRoleName } from '@/modules/studio/roles';
import { ThemeToggle } from '../studio/ui/theme';
import { Oim } from '../studio/ui/brand';
import { pickAgainAction, requestStudioCodeAction, verifyStudioCodeAction, welcomeAction, type Welcome } from './actions';
import { ROLE_CARDS, codeDigits, defaultVia, stepDots, type PickedRole } from './pick';
import { ROLE_TX, SI_WORDS, type SiWord } from './words';

const RESEND_SECONDS = 30;
const EMAIL_SIGN_IN = '/sign-in?next=/studio';

type Step = 'role' | 'contact' | 'code' | 'done';

const LOOK: Record<StudioRoleName, { bg: string; fg: string }> = {
  SALES: { bg: 'var(--warn-bg)', fg: 'var(--warn-s)' },
  DESIGNER: { bg: 'var(--acc-soft)', fg: 'var(--acc)' },
  PM: { bg: 'var(--good-bg)', fg: 'var(--good)' },
  OWNER: { bg: 'var(--ink)', fg: 'var(--paper)' },
  SUPERVISOR: { bg: 'var(--warn-bg)', fg: 'var(--warn-s)' },
  ACCOUNTS: { bg: 'var(--good-bg)', fg: 'var(--good)' },
};

export function StudioSignInForm({ initialLang }: { initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = (key: SiWord, vars?: Record<string, string | number>) => tx(lang, SI_WORDS[key], vars);
  const e = (key: StudioWord, vars?: Record<string, string | number>) => tx(lang, STUDIO_WORDS[key], vars);
  const roleName = (r: StudioRoleName) => tx(lang, ROLE_TX[r]);

  const [step, setStep] = useState<Step>('role');
  const [picked, setPicked] = useState<PickedRole | null>(null);
  const [via, setVia] = useState<'email' | 'phone'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<StudioWord | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [mismatch, setMismatch] = useState<{ real: StudioRoleName; studio: string | null; to: string } | null>(null);
  const [welcome, setWelcome] = useState<Welcome | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') codeInput.current?.focus();
  }, [step]);

  const isSite = picked === 'SUPERVISOR';
  const phoneOk = normalisePhone(phone) !== null;
  const shownPhone = normalisePhone(phone)?.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2') ?? phone;

  function reset(toStep: Step = 'role') {
    setStep(toStep);
    setCode('');
    setError(null);
    setMismatch(null);
  }

  function pick(r: PickedRole) {
    setPicked(r);
    setVia(defaultVia(r));
    setMismatch(null);
    if (r === 'SUPERVISOR') reset('contact');
  }

  async function askForCode() {
    setError(null);
    if (!phoneOk) {
      setError('err.invalid_phone');
      return;
    }
    setBusy(true);
    const r = await requestStudioCodeAction(phone);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDevCode(r.devCode ?? null);
    setCode('');
    setCooldown(RESEND_SECONDS);
    setStep('code');
  }

  async function arrive(dest: string) {
    setTo(dest);
    setStep('done');
    const w = await welcomeAction().catch(() => null);
    setWelcome(w);
  }

  async function submit(value: string) {
    if (value.length !== 6) {
      setShake(true);
      setTimeout(() => setShake(false), 450);
      return;
    }
    setBusy(true);
    setError(null);
    const r = await verifyStudioCodeAction(phone, value, lang, picked);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      setCode('');
      setShake(true);
      setTimeout(() => setShake(false), 450);
      codeInput.current?.focus();
      return;
    }
    if (r.mismatch) {
      setMismatch({ real: r.role, studio: r.studio, to: r.to });
      return;
    }
    await arrive(r.to);
  }

  async function signOutAndRestart() {
    setBusy(true);
    await pickAgainAction().catch(() => undefined);
    setBusy(false);
    setPicked(null);
    setPhone('');
    setDevCode(null);
    setWelcome(null);
    setTo(null);
    reset('role');
  }

  function typeCode(raw: string) {
    const next = codeDigits(raw);
    setCode(next);
    setError(null);
    if (next.length === 6 && !busy && !mismatch) void submit(next);
  }

  const cur: StudioRoleName = welcome?.role ?? mismatch?.real ?? (picked ?? 'SALES');
  const dots = stepDots(step);
  const roleApps = (r: Exclude<PickedRole, 'SUPERVISOR'>) => t(`apps.${r}` as SiWord);

  return (
    <div className="si">
      <aside className="si-bp">
        <span className="bl bl1" />
        <span className="bl bl2" />
        <span className="bl bl3" />
        <span className="bl bl4" />
        <div className="hstack" style={{ gap: 10 }}>
          <Oim width={107} color="currentColor" />
          <span className="pill">Studio</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <h2>{t('bp.h')}</h2>
          <p>{t('bp.p')}</p>
          <div className="si-flow">
            <div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="6" width="18" height="14" rx="2" />
                <circle cx="12" cy="13" r="3.5" />
                <path d="M8 6l1.5-2h5L16 6" />
              </svg>
              {t('bp.f1')} <em>→ {t('bp.f1to')}</em>
            </div>
            <div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 3h7l5 5v13H7z" />
                <path d="M14 3v5h5M10 14l2 2 4-4" />
              </svg>
              {t('bp.f2')} <em>→ {t('bp.f2to')}</em>
            </div>
            <div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12.5 3 3 5-6" />
              </svg>
              {t('bp.f3')} <em>→ {t('bp.f3to')}</em>
            </div>
          </div>
        </div>
        <div className="si-bpstudio">
          <span className="mark">O</span>
          <span>
            <b>{t('bp.studio')}</b>
            <small>{t('bp.studioSub')}</small>
          </span>
        </div>
      </aside>

      <main className="si-wr">
        <div className="si-top">
          <span className="si-ph si-pw">
            {t('powered')} <Oim width={65} />
            <span className="si-pill">Studio</span>
          </span>
          <div className="si-wb si-dots" aria-hidden="true">
            {dots.map((d, i) => (
              <i key={i} className={d} />
            ))}
          </div>
          <div className="si-topr">
            <span className="si-wb si-pw">
              {t('powered')} <Oim width={61} />
            </span>
            <span className="si-wb">
              <LangSeg value={lang} onPick={setLang} />
            </span>
            <ThemeToggle className="thbtn si-thb" />
          </div>
        </div>
        <div className="si-ph si-top">
          <div className="si-dots" aria-hidden="true">
            {dots.map((d, i) => (
              <i key={i} className={d} />
            ))}
          </div>
          <LangSeg value={lang} onPick={setLang} />
        </div>

        <div className="si-col">
          {step === 'role' ? (
            <div className="si-step">
              <div className="si-hgroup">
                <h1>{t('role.h1')}</h1>
                <p className="si-sub">{t('role.sub')}</p>
              </div>
              <div className="si-rgrid" role="radiogroup" aria-label={t('role.group')}>
                {ROLE_CARDS.map((r) => (
                  <button key={r} type="button" className="si-rcard" role="radio" aria-checked={picked === r} onClick={() => pick(r)}>
                    <span className="si-rico" style={{ background: LOOK[r].bg, color: LOOK[r].fg }}>
                      <RoleIcon role={r} />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <b>{roleName(r)}</b>
                      <small>{roleApps(r)}</small>
                    </span>
                    {picked === r ? (
                      <span className="si-rok acc">
                        <Tick size={13} />
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
              <button type="button" className="si-site" onClick={() => pick('SUPERVISOR')}>
                <span className="si-rico" style={{ background: LOOK.SUPERVISOR.bg, color: LOOK.SUPERVISOR.fg }}>
                  <RoleIcon role="SUPERVISOR" size={20} />
                </span>
                <span className="t">
                  <b style={{ fontWeight: 600 }}>{t('site.h')}</b>
                  <small>{t('site.sub')}</small>
                </span>
                <Arrow />
              </button>
              <div className="si-grow" />
              <div className="si-foot">
                <button
                  type="button"
                  className="si-cta pri"
                  aria-disabled={!picked || isSite}
                  onClick={() => {
                    if (picked && !isSite) reset('contact');
                  }}
                >
                  {picked && !isSite ? t('role.continue', { role: roleName(picked) }) : t('role.pick')} <Arrow />
                </button>
                <Link href="/apply" className="si-hint">
                  {e('signin.newStudio')}
                </Link>
              </div>
            </div>
          ) : null}

          {step === 'contact' ? (
            <form
              className="si-step"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (via === 'phone' && !busy) void askForCode();
              }}
            >
              <button
                type="button"
                className="si-back"
                onClick={() => {
                  if (isSite) setPicked(null);
                  reset('role');
                }}
              >
                <BackArrow /> {t('back')}
              </button>
              {picked ? (
                <div className="si-as">
                  <span className="si-rico" style={{ background: LOOK[picked].bg, color: LOOK[picked].fg }}>
                    <RoleIcon role={picked} size={20} />
                  </span>
                  <span>{t('as', { role: roleName(picked) })}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSite) setPicked(null);
                      reset('role');
                    }}
                  >
                    {t('change')}
                  </button>
                </div>
              ) : null}
              <div className="si-hgroup">
                <h1>{via === 'email' ? t('contact.email.h1') : t('contact.phone.h1')}</h1>
                <p className="si-sub">{via === 'email' ? t('contact.email.sub') : t('contact.phone.sub')}</p>
              </div>
              {!isSite ? (
                <div className="si-seg" role="radiogroup" aria-label={t('via')}>
                  <button type="button" role="radio" aria-checked={via === 'email'} onClick={() => setVia('email')}>
                    {t('via.email')}
                  </button>
                  <button type="button" role="radio" aria-checked={via === 'phone'} onClick={() => setVia('phone')}>
                    {t('via.phone')}
                  </button>
                </div>
              ) : null}

              {via === 'phone' ? (
                <>
                  <div className="si-fld">
                    <label htmlFor="studio-phone">{e('signin.phone')}</label>
                    <div className="si-box">
                      <span className="pre">+91</span>
                      <input
                        id="studio-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="98220 55310"
                        value={phone}
                        onChange={(ev) => {
                          setPhone(ev.target.value.replace(/[^\d +]/g, '').slice(0, 16));
                          setError(null);
                        }}
                      />
                      {phoneOk ? (
                        <span className="si-okd">
                          <Tick size={12} />
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="si-note">
                    <Lock />
                    <span>{t('phone.note')}</span>
                  </div>
                </>
              ) : (
                <div className="si-note">
                  <Lock />
                  <span>{t('email.note')}</span>
                </div>
              )}
              {error ? (
                <p role="alert" className="si-err">
                  {e(error)}
                </p>
              ) : null}
              <div className="si-grow" />
              <div className="si-foot">
                {via === 'phone' ? (
                  <>
                    <button type="submit" className="si-cta pri" aria-disabled={!phoneOk || busy}>
                      {e('signin.getCode')} <Arrow />
                    </button>
                    <span className="si-hint">{phoneOk ? t('phone.hintOk') : t('phone.hintMore')}</span>
                  </>
                ) : (
                  <>
                    <a href={EMAIL_SIGN_IN} className="si-cta pri">
                      {t('email.cta')} <Arrow />
                    </a>
                    <span className="si-hint">{t('email.hint')}</span>
                  </>
                )}
              </div>
            </form>
          ) : null}

          {step === 'code' ? (
            <form
              className="si-step"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (!busy && !mismatch) void submit(code);
              }}
            >
              <button type="button" className="si-back" onClick={() => reset('contact')}>
                <BackArrow /> {t('back')}
              </button>
              <div className="si-hgroup">
                <h1>{t('code.h1')}</h1>
                <p className="si-sub">
                  {t('code.sent', { phone: shownPhone })}{' '}
                  <button
                    type="button"
                    className="si-link"
                    onClick={() => {
                      setDevCode(null);
                      reset('contact');
                    }}
                  >
                    {e('signin.otherNumber')}
                  </button>
                </p>
              </div>
              <div className={`si-otp${shake ? ' shake' : ''}`}>
                {Array.from({ length: 6 }, (_, i) => (
                  <i key={i} className={`${code[i] ? 'f' : ''}${i === code.length ? ' cur' : ''}`} aria-hidden="true">
                    {code[i] ?? ''}
                  </i>
                ))}
                <input
                  ref={codeInput}
                  aria-label={t('code.label')}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={12}
                  value={code}
                  disabled={busy || mismatch !== null}
                  onChange={(ev) => typeCode(ev.target.value)}
                  onPaste={(ev) => {
                    ev.preventDefault();
                    typeCode(ev.clipboardData.getData('text'));
                  }}
                />
              </div>
              <div className="si-row">
                <span>{cooldown > 0 ? e('signin.resendIn', { s: String(cooldown).padStart(2, '0') }) : null}</span>
                {cooldown <= 0 ? (
                  <button type="button" className="si-link" onClick={() => void askForCode()} disabled={busy}>
                    {e('signin.resend')}
                  </button>
                ) : null}
              </div>
              {devCode ? <p className="si-dev">{e('signin.devCode', { code: devCode })}</p> : null}
              {error ? (
                <p role="alert" className="si-err">
                  {e(error)}
                </p>
              ) : null}
              {mismatch ? (
                <div className="si-warnc" role="alert">
                  <b>{t('mis.h', { studio: mismatch.studio ?? 'Your studio', real: roleName(mismatch.real), picked: picked ? roleName(picked) : '' })}</b>
                  <p>{t('mis.p', { real: roleName(mismatch.real) })}</p>
                  <div className="btns">
                    <button type="button" className="p" onClick={() => void arrive(mismatch.to)}>
                      {t('mis.go', { real: roleName(mismatch.real) })}
                    </button>
                    <button type="button" className="s" disabled={busy} onClick={() => void signOutAndRestart()}>
                      {t('mis.again')}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="si-grow" />
              <div className="si-foot">
                <button type="submit" className="si-cta pri" aria-disabled={code.length !== 6 || busy || mismatch !== null}>
                  {busy ? '…' : t('code.verify')} <Arrow />
                </button>
                <span className="si-hint">{t('code.help')}</span>
              </div>
            </form>
          ) : null}

          {step === 'done' ? (
            <div className="si-step">
              <div className="si-done">
                <span className="si-bigok" style={{ background: LOOK[cur].bg, color: LOOK[cur].fg }}>
                  <Tick size={40} />
                </span>
                <h1>{welcome?.name ? t('done.h1', { name: welcome.name }) : t('done.h1NoName')}</h1>
                {welcome ? (
                  <p className="si-sub">
                    {t(welcome.waiting.length ? 'done.sub' : 'done.subNone', { studio: welcome.studio ?? 'Your studio', role: roleName(welcome.role) })}
                  </p>
                ) : null}
                {welcome?.waiting.length ? (
                  <div className="si-lands">
                    {welcome.waiting.map((w) => (
                      <span key={w.word}>{waitingLine(w.word, w.n, t)}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="si-foot">
                <a href={welcome?.to ?? to ?? '/studio'} className="si-cta pri">
                  {t('done.open', { home: (welcome?.role ?? cur) === 'SUPERVISOR' ? t('done.home.site') : t('done.home.office') })} <Arrow />
                </a>
                <button type="button" className="si-link" disabled={busy} onClick={() => void signOutAndRestart()}>
                  {t('done.signOut')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function waitingLine(word: Welcome['waiting'][number]['word'], n: number, t: (k: SiWord, v?: Record<string, string | number>) => string): string {
  const one: Partial<Record<typeof word, SiWord>> = { calls: 'w.call1', quotes: 'w.quote1', meetings: 'w.meeting1', tasks: 'w.task1', projects: 'w.project1', sites: 'w.site1', snags: 'w.snag1' };
  const key = n === 1 && one[word] ? one[word]! : (`w.${word}` as SiWord);
  return t(key, { n });
}

/** EN / हिं / मरा in the design's segmented control; the same `oa.lang` cookie as the rest of the studio. */
function LangSeg({ value, onPick }: { value: Lang; onPick: (l: Lang) => void }) {
  return (
    <div className="seg" role="group" aria-label="Language">
      {LANGS.map(({ id }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          aria-label={STUDIO_LANG_LABEL[id].full}
          onClick={() => {
            keepLang(id);
            onPick(id);
          }}
        >
          {STUDIO_LANG_LABEL[id].short}
        </button>
      ))}
    </div>
  );
}

function RoleIcon({ role, size = 24 }: { role: StudioRoleName; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, className: 'ai' };
  switch (role) {
    case 'SALES':
      return (
        <svg {...p}>
          <path className="a-bob1" d="M4 5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          <path className="a-write" d="M6 9.5h8" />
          <path className="a-write w2" d="M6 12.5h5" />
          <circle className="a-ping" cx="20" cy="5" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'DESIGNER':
      return (
        <svg {...p}>
          <path d="M3 21h18" />
          <path className="a-bob1" d="M14.5 4.5l3 3L8 17H5v-3z" />
          <path className="a-write" d="M12.5 6.5l3 3" />
        </svg>
      );
    case 'PM':
      return (
        <svg {...p}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V3h6v1" />
          <path className="a-write" d="M8.5 10l1.5 1.5L13 8.5" />
          <path className="a-write w2" d="M8.5 15.5l1.5 1.5L13 14" />
          <path d="M15 10h1M15 16h1" />
        </svg>
      );
    case 'SUPERVISOR':
      return (
        <svg {...p}>
          <path className="a-float" d="M3 17h18M5 17v-3a7 7 0 0 1 14 0v3M10 7.5V11M14 7.5V11" />
          <path d="M3 17v2h18v-2" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <rect className="a-bob1" x="3.5" y="3.5" width="7" height="7" rx="2" />
          <rect className="a-bob2" x="13.5" y="3.5" width="7" height="7" rx="2" />
          <rect className="a-bob2" x="3.5" y="13.5" width="7" height="7" rx="2" />
          <circle className="a-gear" cx="17" cy="17" r="3.2" strokeDasharray="2.5 1.6" />
        </svg>
      );
  }
}

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BackArrow = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M14.5 9h-11M8 4.5 3.5 9 8 13.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Tick = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

const Lock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
