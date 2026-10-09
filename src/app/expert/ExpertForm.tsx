'use client';

/**
 * Booking the expert call — as little friction as the call allows (owner,
 * 10 Oct 2026: "I don't want this many questions to be asked").
 *
 * Four short steps on one screen, each a card:
 *
 *   1. Which studios to talk about — the ones they compared are ticked.
 *   2. A date, then a time.
 *   3. Who it is for — the name and number were taken at the start, so this
 *      is a confirmation with a Change link, not a form.
 *   4. A 6-digit WhatsApp code, then Confirm booking.
 *
 * The question builder and the free-text agenda are gone: the architect has
 * already read the brief and every quote, and the call is where the questions
 * get asked. Consent to share with the chosen studios is the sentence right
 * above the button; pressing Confirm is the act it describes.
 *
 * The code is verified before the booking is sent, and the server refuses a
 * booking whose number is not the signed-in, verified one (actions.ts). In a
 * build with no database (`preview`) any six digits pass and nothing is booked.
 */

import { startTransition, useActionState, useEffect, useState } from 'react';
import { readContact, rememberContact } from '@/lib/remembered-contact';
import { googleCalendarUrl, slotLabel } from '@/modules/consultation/slots';
import { ARCHITECT } from '@/modules/consultation/architect';
import { formatINRCompact } from '@/lib/money';
import { normalisePhone } from '@/modules/studio/phone';
import { requestOtpAction, verifyOtpAction } from '@/app/sign-in/actions';
import { Pill, PillButton, Split } from '@/components/home/parts';
import { requestExpertAction, type ExpertState } from './actions';
import { useLang, useSiteT } from '@/components/app/i18n';
import { EXPERT_DICT, known } from '@/modules/i18n/site/expert';
import type { Lang } from '@/modules/i18n/site';

const INITIAL: ExpertState = { status: 'idle' };
const RESEND_S = 30;

export interface StudioOption {
  id: string;
  name: string;
  lowPaise: number;
  highPaise: number;
}

/**
 * A slot as the customer reads it. English is `slotLabel` exactly; Hindi and
 * Marathi use the same Pune-time formatting in their own locale.
 */
function slotText(iso: string, lang: Lang): { day: string; time: string } {
  if (lang === 'en') return slotLabel(iso);
  const d = new Date(iso);
  const locale = lang === 'hi' ? 'hi-IN' : 'mr-IN';
  return {
    day: d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }),
    time: d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
  };
}

/** "Fri" and "9" for the day tiles, Pune time. */
function weekdayOf(iso: string, lang: Lang): string {
  const locale = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  return new Date(iso).toLocaleDateString(locale, { weekday: 'short', timeZone: 'Asia/Kolkata' });
}
function dateOf(iso: string, lang: Lang): string {
  const locale = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', timeZone: 'Asia/Kolkata', numberingSystem: 'latn' });
}

/** "Sat 11 Oct" in the visitor's language, Pune time. */
function dayChip(iso: string, lang: Lang): string {
  const locale = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  return new Date(iso).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function ExpertForm({
  briefId,
  studios,
  defaultName,
  defaultPhone = null,
  defaultEmail,
  minStudios,
  maxStudios,
  slots = [],
  preselected = [],
  initialSlot = null,
  preview = false,
}: {
  briefId: string;
  studios: StudioOption[];
  defaultName: string | null;
  /** The number they gave at the start, when the server knows it. */
  defaultPhone?: string | null;
  defaultEmail: string | null;
  minStudios: number;
  maxStudios: number;
  /** Open 30-minute slots (ISO). Empty when no expert has hours set — then we call to fix a time. */
  slots?: string[];
  /** The studios they compared — ticked for them. */
  preselected?: string[];
  /** A slot already picked in the app (/app/expert), kept only if it is still open. */
  initialSlot?: string | null;
  /** A build with no database: walk the flow, book nothing. */
  preview?: boolean;
}) {
  const t = useSiteT(EXPERT_DICT);
  const lang = useLang();
  const [state, action, pending] = useActionState(requestExpertAction, INITIAL);
  const booking = slots.length > 0;
  const startSlot = initialSlot && slots.includes(initialSlot) ? initialSlot : null;
  const [slot, setSlot] = useState<string | null>(startSlot);
  const [day, setDay] = useState<string | null>(startSlot ? dayKey(startSlot) : slots[0] ? dayKey(slots[0]) : null);
  const [picked, setPicked] = useState<string[]>(
    preselected.length > 0 ? preselected.slice(0, maxStudios) : studios.slice(0, 2).map((s) => s.id),
  );

  /* Name and number from the start of the brief (this device, or the server). */
  const [name, setName] = useState(defaultName ?? '');
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const r = readContact();
    if (r) {
      setName((n) => n || r.name);
      setPhone((p) => p || r.phone);
      setEmail((m) => m || r.email);
    }
  }, []);
  useEffect(() => {
    if (name || phone || email) rememberContact({ name, phone, email });
  }, [name, phone, email]);

  /* The code. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [previewDone, setPreviewDone] = useState(false);
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const err = state.errors ?? {};

  if (state.status === 'sent' || previewDone) {
    const scheduledFor = state.status === 'sent' ? state.scheduledFor : slot ?? undefined;
    const when = scheduledFor ? slotText(scheduledFor, lang) : null;
    const calLabel = t('cal.add');
    return (
      <section className="flow-card" data-reveal="" data-auto="">
        <p className="eyebrow">
          <i aria-hidden className="mr-2.5 inline-block h-[7px] w-[7px] rounded-full bg-[var(--accent)] align-middle" />
          {when ? t('sent.booked') : t('sent.requested')}
        </p>
        <Split
          as="h2"
          className="h-l max-w-[18ch]"
          text={when ? t('sent.when', { day: when.day, time: when.time }) : t('sent.weCall')}
          auto
        />
        <p className="lede">{when ? t('sent.bookedBody') : t('sent.requestedBody')}</p>
        <p className="m-0 mt-5 text-[16px] text-[var(--ink)]">
          {t('sent.with')} <strong className="font-medium">{ARCHITECT.name}</strong> · {known(lang, 'architect.role', ARCHITECT.role)}
        </p>
        {previewDone ? <p className="m-0 mt-3 text-[13px] text-[var(--accent-ink)]">{t('flow.testBuild')}</p> : null}
        {scheduledFor ? (
          <p className="m-0 mt-6">
            {/* A new tab, so the landing's pill markup by hand (Pill has no target). */}
            <a
              href={googleCalendarUrl({
                startsAt: scheduledFor,
                title: t('cal.title', { name: ARCHITECT.name }),
                details: t('cal.details'),
              })}
              target="_blank"
              rel="noreferrer"
              className="pill pill-line pill-sm"
              data-magnetic=""
            >
              <span className="mag-inner">
                <span className="roll">
                  <span data-t={calLabel}>{calLabel}</span>
                </span>
              </span>
            </a>
          </p>
        ) : null}

        {/* The next thing to do, so the confirmation is not a dead end. */}
        <div className="mt-[clamp(28px,4vw,44px)] rounded-[var(--r-m)] bg-[var(--paper)] p-[clamp(20px,2.6vw,32px)]">
          <p className="m-0 mb-5 max-w-[58ch] text-[15px] leading-[1.6] text-[var(--ink-2)]">{t('prep.body')}</p>
          <Pill href="/account#rooms" arrow>
            {t('prep.cta')}
          </Pill>
          <p className="m-0 mt-4 text-[13px] text-[var(--ink-2)]">{t('prep.note')}</p>
        </div>
      </section>
    );
  }

  const toggleStudio = (id: string) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < maxStudios ? [...prev, id] : prev,
    );

  /* The slots, grouped by day: a date first, then the times on it. */
  const days: { key: string; label: string; times: string[] }[] = [];
  for (const iso of slots) {
    const key = dayKey(iso);
    let d = days.find((x) => x.key === key);
    if (!d) {
      d = { key, label: dayChip(iso, lang), times: [] };
      days.push(d);
    }
    d.times.push(iso);
  }
  const activeDay = days.find((d) => d.key === day) ?? null;

  const phoneOk = Boolean(normalisePhone(phone));
  const blocker =
    picked.length < minStudios
      ? t('flow.needStudios', { n: minStudios })
      : booking && !slot
        ? t('flow.needSlot')
        : !phoneOk || !name.trim()
          ? t('flow.needPhone')
          : null;
  const codeOpen = sentTo !== null && sentTo === phone;

  const sendCode = async () => {
    if (blocker) return;
    setCodeError(null);
    setCode('');
    if (preview) {
      setSentTo(phone);
      setWait(RESEND_S);
      return;
    }
    setSending(true);
    const r = await requestOtpAction(phone, name);
    setSending(false);
    if (!r.ok) return setCodeError(r.error);
    setSentTo(phone);
    setDevCode(r.devCode ?? null);
    setWait(RESEND_S);
  };

  const confirm = async () => {
    if (blocker || code.length !== 6) return;
    setCodeError(null);
    if (preview) {
      setPreviewDone(true);
      return;
    }
    setConfirming(true);
    const v = await verifyOtpAction(phone, code, name);
    setConfirming(false);
    if (!v.ok) return setCodeError(v.error);
    const data = new FormData();
    data.set('briefId', briefId);
    picked.forEach((id) => data.append('studioIds', id));
    data.set('contactName', name.trim());
    data.set('contactPhone', phone);
    data.set('contactEmail', email.trim());
    data.set('startsAt', slot ?? '');
    // The sentence above the button says what confirming agrees to; pressing it is the act.
    data.set('shareConsent', 'on');
    startTransition(() => action(data));
  };

  /* The landing's palette on a soft card: white tiles, filled with ink once
     chosen. Hand-rolled rather than `.flow-opt`, whose pill shape and centred
     content (unlayered CSS) a utility cannot override. */
  const tile = (on: boolean) =>
    `cursor-pointer border-0 transition-[background-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] ${
      on ? 'bg-[var(--ink)] text-white' : 'bg-[var(--paper)] text-[var(--ink)] hover:shadow-[inset_0_0_0_1px_var(--ink)]'
    }`;
  /* `.flow-input` sits on a soft card, so the field is white rather than soft. */
  const field = { background: 'var(--paper)' } as const;
  const confirmLabel =
    confirming || pending
      ? t('flow.confirming')
      : slot
        ? `${t('flow.confirm')} · ${dayChip(slot, lang)}, ${slotText(slot, lang).time}`
        : t('flow.confirm');
  /* The dated label is long for a phone; let it wrap there rather than clip. */
  const longPill = 'max-w-full whitespace-normal! py-3! leading-[1.25]!';

  return (
    <div className="flex flex-col gap-4">
      {/* 1 · Studios */}
      <section className="flow-card" data-reveal="" style={{ ['--d' as string]: '120ms' }}>
        <Step n={1} title={t('flow.step1')} help={t('flow.step1Help', { min: minStudios, max: maxStudios })} />
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {studios.map((studio) => {
            const checked = picked.includes(studio.id);
            return (
              <li key={studio.id}>
                <button
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggleStudio(studio.id)}
                  className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-[var(--r-m)] px-5 py-3 text-left ${tile(checked)}`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${
                        checked ? 'bg-[var(--accent)] text-white' : 'shadow-[inset_0_0_0_1.5px_var(--line)]'
                      }`}
                    >
                      {checked ? (
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M3.5 8.4 6.6 11.4 12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </span>
                    <span className="text-[16px] font-medium">{studio.name}</span>
                  </span>
                  <span className={`text-[13.5px] tabular-nums ${checked ? 'text-white/65' : 'text-[var(--ink-2)]'}`}>
                    {formatINRCompact(studio.lowPaise)}–{formatINRCompact(studio.highPaise)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {err.studioIds ? <Alert>{err.studioIds}</Alert> : null}
      </section>

      {/* 2 · Date, then time */}
      <section className="flow-card" data-reveal="">
        <Step n={2} title={t('flow.step2')} />
        {booking ? (
          <>
            <p className="eyebrow">{t('flow.pickDay')}</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {days.slice(0, 7).map((d) => {
                const on = day === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setDay(d.key);
                      if (slot && !d.times.includes(slot)) setSlot(null);
                    }}
                    className={`min-h-[76px] rounded-[var(--r-m)] py-3 text-center ${tile(on)}`}
                  >
                    <small className={`block text-[13px] font-medium ${on ? 'text-white/65' : 'text-[var(--ink-2)]'}`}>
                      {weekdayOf(d.times[0]!, lang)}
                    </small>
                    <b className="mt-1.5 block text-[26px] font-medium leading-none tracking-[-0.04em] tabular-nums">
                      {dateOf(d.times[0]!, lang)}
                    </b>
                  </button>
                );
              })}
            </div>
            {activeDay ? (
              <div className="mt-7">
                <p className="eyebrow">{t('flow.step2Time')}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {activeDay.times.map((iso) => (
                    <button
                      key={iso}
                      type="button"
                      aria-pressed={slot === iso}
                      onClick={() => setSlot(iso)}
                      className={`min-h-[52px] rounded-full text-[15px] font-medium tabular-nums ${tile(slot === iso)}`}
                    >
                      {slotText(iso, lang).time}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {preview ? <p className="m-0 mt-4 text-[13px] text-[var(--accent-ink)]">{t('flow.sampleHours')}</p> : null}
            {err.startsAt ? <Alert>{err.startsAt}</Alert> : null}
          </>
        ) : (
          <p className="m-0 max-w-[60ch] text-[15px] leading-[1.6] text-[var(--ink-2)]">{t('flow.step2None')}</p>
        )}
      </section>

      {/* 3 · Who it is for — already known, so a confirmation, not a form */}
      <section className="flow-card" data-reveal="">
        <Step n={3} title={t('flow.step3')} />
        {editing || !name.trim() || !phoneOk ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block px-1 text-[13px] font-medium text-[var(--ink-2)]">{t('flow.name')}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 80))}
                autoComplete="name"
                className="flow-input"
                style={field}
              />
            </label>
            <label className="block">
              <span className="mb-2 block px-1 text-[13px] font-medium text-[var(--ink-2)]">{t('flow.mobile')}</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.slice(0, 16))}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
                className="flow-input"
                style={field}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block px-1 text-[13px] font-medium text-[var(--ink-2)]">{t('flow.email')}</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value.slice(0, 120))}
                inputMode="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="flow-input"
                style={field}
              />
            </label>
            {editing && name.trim() && phoneOk ? (
              <div className="sm:col-span-2">
                <PillButton tone="line" size="sm" onClick={() => setEditing(false)}>
                  {t('flow.done')}
                </PillButton>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-m)] bg-[var(--paper)] px-5 py-4">
            <p className="m-0 text-[17px] text-[var(--ink)]">
              <span className="block font-medium">{name}</span>
              <span className="mt-1 block text-[15px] font-normal tabular-nums text-[var(--ink-2)]">+91 {phone}</span>
              {email.trim() ? (
                <span className="mt-0.5 block break-all text-[15px] font-normal text-[var(--ink-2)]">{email.trim()}</span>
              ) : null}
            </p>
            <PillButton tone="line" size="sm" onClick={() => setEditing(true)}>
              {t('flow.change')}
            </PillButton>
          </div>
        )}
        {err.contactName ? <Alert>{err.contactName}</Alert> : null}
        {err.contactPhone ? <Alert>{err.contactPhone}</Alert> : null}
        {err.contactEmail ? <Alert>{err.contactEmail}</Alert> : null}
      </section>

      {/* 4 · The code, then the booking */}
      <section className="flow-card" data-reveal="">
        <Step n={4} title={t('flow.step4')} />
        {codeOpen ? (
          <>
            <p className="m-0 mb-4 max-w-[60ch] text-[15px] text-[var(--ink-2)]">{t('flow.codeSent', { phone })}</p>
            <label className="block max-w-[280px]">
              <span className="mb-2 block px-1 text-[13px] font-medium text-[var(--ink-2)]">{t('flow.code')}</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="······"
                className="flow-input"
                style={{ ...field, textAlign: 'center', fontSize: 20, letterSpacing: '0.4em' }}
              />
            </label>
            <p className="m-0 mt-3 px-1 text-[13px] text-[var(--ink-2)]">
              {wait > 0 ? (
                t('flow.resendIn', { s: wait })
              ) : (
                <button type="button" onClick={sendCode} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[var(--ink)] underline">
                  {t('flow.resend')}
                </button>
              )}
            </p>
            {devCode ? <p className="m-0 mt-2 px-1 text-[13px] text-[var(--accent-ink)]">Test build · your code is {devCode}</p> : null}
            {preview ? <p className="m-0 mt-2 px-1 text-[13px] text-[var(--accent-ink)]">{t('flow.testBuild')}</p> : null}
          </>
        ) : null}

        {codeError ? <Alert>{codeError}</Alert> : null}
        {err.form ? <Alert>{err.form}</Alert> : null}
        {err.shareConsent ? <Alert>{err.shareConsent}</Alert> : null}

        <p className="m-0 mb-5 mt-5 max-w-[60ch] text-[13.5px] leading-[1.6] text-[var(--ink-2)]">{t('flow.consent')}</p>
        {codeOpen ? (
          <PillButton
            arrow
            size="lg"
            className={longPill}
            onClick={confirm}
            disabled={Boolean(blocker) || code.length !== 6 || confirming || pending}
          >
            {confirmLabel}
          </PillButton>
        ) : (
          <PillButton arrow size="lg" className={longPill} onClick={sendCode} disabled={Boolean(blocker) || sending}>
            {sending ? t('flow.sending') : t('flow.sendCode')}
          </PillButton>
        )}
        {blocker ? <p className="m-0 mt-3 px-1 text-[13px] text-[var(--ink-2)]">{blocker}</p> : null}
      </section>
    </div>
  );
}

/** A step's heading: the number in a small ink circle, then the landing's `.h-m`. */
function Step({ n, title, help }: { n: number; title: string; help?: string }) {
  return (
    <div className="mb-6 flex items-start gap-3.5">
      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--ink)] text-[13px] font-medium tabular-nums text-white sm:mt-1.5">
        {n}
      </span>
      <div>
        <Split as="h2" className="h-m" text={title} />
        {help ? <p className="m-0 mt-2 text-[15px] text-[var(--ink-2)]">{help}</p> : null}
      </div>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="m-0 mt-3 px-1 text-[14px]" style={{ color: 'var(--accent-ink)' }}>
      {children}
    </p>
  );
}
