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
import { readContact, rememberContact, type RememberedContact } from '@/lib/remembered-contact';
import { googleCalendarUrl, slotLabel } from '@/modules/consultation/slots';
import { ARCHITECT } from '@/modules/consultation/architect';
import { formatINRCompact } from '@/lib/money';
import { normalisePhone } from '@/modules/studio/phone';
import { requestOtpAction, verifyOtpAction } from '@/app/sign-in/actions';
import { Sheet, Tick } from '@/components/oi';
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
  const [remembered, setRemembered] = useState<RememberedContact | null>(null);
  const [name, setName] = useState(defaultName ?? '');
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const r = readContact();
    setRemembered(r);
    if (r) {
      setName((n) => n || r.name);
      setPhone((p) => p || r.phone);
    }
  }, []);
  useEffect(() => {
    if (name || phone) rememberContact({ name, phone });
  }, [name, phone]);

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
    return (
      <Sheet className="rounded-[22px] p-[clamp(22px,3vw,34px)]">
        <p className="oi-eyebrow m-0 mb-4">{when ? t('sent.booked') : t('sent.requested')}</p>
        <h2 className="oi-display m-0 mb-4 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]">
          {when ? t('sent.when', { day: when.day, time: when.time }) : t('sent.weCall')}
        </h2>
        <p className="m-0 mb-3 max-w-[58ch] text-[15px] leading-[1.65] text-[var(--ink2)]">
          {when ? t('sent.bookedBody') : t('sent.requestedBody')}
        </p>
        <p className="m-0 mb-5 text-[15px] text-[var(--ink)]">
          {t('sent.with')} <strong className="font-semibold">{ARCHITECT.name}</strong> · {known(lang, 'architect.role', ARCHITECT.role)}
        </p>
        {previewDone ? <p className="m-0 mb-5 text-[13px] text-[var(--acc-ink)]">{t('flow.testBuild')}</p> : null}
        {scheduledFor ? (
          <p className="m-0 mb-6">
            <a
              href={googleCalendarUrl({
                startsAt: scheduledFor,
                title: t('cal.title', { name: ARCHITECT.name }),
                details: t('cal.details'),
              })}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-5 text-[14px] font-medium text-[var(--ink)] no-underline hover:border-[var(--ink)]"
            >
              {t('cal.add')}
            </a>
          </p>
        ) : null}

        {/* The next thing to do, so the confirmation is not a dead end. */}
        <div className="border-t border-[var(--line)] pt-6">
          <p className="m-0 mb-5 max-w-[58ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">{t('prep.body')}</p>
          <a href="/account#rooms" className="oi-cta inline-flex min-h-11 items-center rounded-full px-6 py-3 text-[14.5px] text-white no-underline">
            {t('prep.cta')}
          </a>
          <p className="m-0 mt-4 text-[13px] text-[var(--ink2)]">{t('prep.note')}</p>
        </div>
      </Sheet>
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
    data.set('contactEmail', remembered?.email ?? defaultEmail ?? '');
    data.set('startsAt', slot ?? '');
    // The sentence above the button says what confirming agrees to; pressing it is the act.
    data.set('shareConsent', 'on');
    startTransition(() => action(data));
  };

  const card = 'rounded-[22px] border border-[var(--line)] bg-[var(--card)] p-[clamp(18px,2.6vw,28px)]';
  const pill = 'oi-cta min-h-12 cursor-pointer rounded-full border-0 px-8 py-3.5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex flex-col gap-5">
      {/* 1 · Studios */}
      <section className={card}>
        <Step n={1} title={t('flow.step1')} help={t('flow.step1Help', { min: minStudios, max: maxStudios })} />
        <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2">
          {studios.map((studio) => {
            const checked = picked.includes(studio.id);
            return (
              <li key={studio.id}>
                <button
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggleStudio(studio.id)}
                  className={`flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-[16px] border px-4 py-3 text-left transition-colors ${
                    checked ? 'border-[var(--ink)] bg-[var(--acc-wash)]' : 'border-[var(--line)] bg-[var(--bg)] hover:border-[var(--ink2)]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border ${
                        checked ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-[var(--line)]'
                      }`}
                    >
                      {checked ? <Tick style={{ width: 11, height: 11 }} /> : null}
                    </span>
                    <span className="text-[15px] font-medium text-[var(--ink)]">{studio.name}</span>
                  </span>
                  <span className="oi-num text-[12.5px] text-[var(--ink2)]">
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
      <section className={card}>
        <Step n={2} title={t('flow.step2')} />
        {booking ? (
          <>
            <p className="oi-label m-0 mb-3">{t('flow.pickDay')}</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {days.slice(0, 7).map((d) => (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={day === d.key}
                  onClick={() => {
                    setDay(d.key);
                    if (slot && !d.times.includes(slot)) setSlot(null);
                  }}
                  className={`cursor-pointer rounded-[16px] border py-3 text-center transition-colors ${
                    day === d.key
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                      : 'border-[var(--line)] bg-transparent text-[var(--ink)] hover:border-[var(--ink2)]'
                  }`}
                >
                  <small className="oi-num block text-[13px]">{weekdayOf(d.times[0]!, lang)}</small>
                  <b className="mt-1 block text-[24px] font-semibold leading-none">{dateOf(d.times[0]!, lang)}</b>
                </button>
              ))}
            </div>
            {activeDay ? (
              <>
                <p className="oi-label m-0 mb-3 mt-6">{t('flow.step2Time')}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {activeDay.times.map((iso) => (
                    <button
                      key={iso}
                      type="button"
                      aria-pressed={slot === iso}
                      onClick={() => setSlot(iso)}
                      className={`oi-num min-h-[50px] cursor-pointer rounded-full border text-[15px] transition-colors ${
                        slot === iso
                          ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                          : 'border-[var(--line)] bg-transparent text-[var(--ink)] hover:border-[var(--ink2)]'
                      }`}
                    >
                      {slotText(iso, lang).time}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {preview ? <p className="m-0 mt-4 text-[13px] text-[var(--acc-ink)]">{t('flow.sampleHours')}</p> : null}
            {err.startsAt ? <Alert>{err.startsAt}</Alert> : null}
          </>
        ) : (
          <p className="m-0 text-[14.5px] leading-[1.6] text-[var(--ink2)]">{t('flow.step2None')}</p>
        )}
      </section>

      {/* 3 · Who it is for — already known, so a confirmation, not a form */}
      <section className={card}>
        <Step n={3} title={t('flow.step3')} />
        {editing || !name.trim() || !phoneOk ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="oi-label mb-2 block">{t('flow.name')}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 80))}
                autoComplete="name"
                className="w-full rounded-full border border-[var(--line)] bg-[var(--bg)] px-5 py-3 text-[15px] text-[var(--ink)]"
              />
            </label>
            <label className="block">
              <span className="oi-label mb-2 block">{t('flow.mobile')}</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.slice(0, 16))}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
                className="w-full rounded-full border border-[var(--line)] bg-[var(--bg)] px-5 py-3 text-[15px] font-normal tabular-nums text-[var(--ink)]"
              />
            </label>
            {editing && name.trim() && phoneOk ? (
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="cursor-pointer rounded-full border border-[var(--line)] bg-transparent px-4 py-2 text-[13.5px] font-medium text-[var(--ink)] hover:border-[var(--ink)]"
                >
                  {t('flow.done')}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[16px] text-[var(--ink)]">
              <span className="block font-medium">{name}</span>
              <span className="mt-1 block text-[15px] font-normal tabular-nums text-[var(--ink2)]">+91 {phone}</span>
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="cursor-pointer rounded-full border border-[var(--line)] bg-transparent px-4 py-1.5 text-[13px] font-medium text-[var(--ink2)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
            >
              {t('flow.change')}
            </button>
          </div>
        )}
        {err.contactName ? <Alert>{err.contactName}</Alert> : null}
        {err.contactPhone ? <Alert>{err.contactPhone}</Alert> : null}
      </section>

      {/* 4 · The code, then the booking */}
      <section className={card}>
        <Step n={4} title={t('flow.step4')} />
        {codeOpen ? (
          <>
            <p className="m-0 mb-4 text-[14.5px] text-[var(--ink2)]">{t('flow.codeSent', { phone })}</p>
            <label className="block max-w-[260px]">
              <span className="oi-label mb-2 block">{t('flow.code')}</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="······"
                className="w-full rounded-full border border-[var(--line)] bg-[var(--bg)] px-5 py-3 text-center font-normal tabular-nums text-[20px] tracking-[0.4em] text-[var(--ink)]"
              />
            </label>
            <p className="m-0 mt-3 text-[13px] text-[var(--ink2)]">
              {wait > 0 ? (
                t('flow.resendIn', { s: wait })
              ) : (
                <button type="button" onClick={sendCode} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[var(--ink)] underline">
                  {t('flow.resend')}
                </button>
              )}
            </p>
            {devCode ? <p className="m-0 mt-2 text-[13px] text-[var(--acc-ink)]">Test build · your code is {devCode}</p> : null}
            {preview ? <p className="m-0 mt-2 text-[13px] text-[var(--acc-ink)]">{t('flow.testBuild')}</p> : null}
          </>
        ) : null}

        {codeError ? <Alert>{codeError}</Alert> : null}
        {err.form ? <Alert>{err.form}</Alert> : null}
        {err.shareConsent ? <Alert>{err.shareConsent}</Alert> : null}

        <p className="m-0 mb-5 mt-5 max-w-[60ch] text-[13px] leading-[1.6] text-[var(--ink2)]">{t('flow.consent')}</p>
        {codeOpen ? (
          <button
            type="button"
            onClick={confirm}
            disabled={Boolean(blocker) || code.length !== 6 || confirming || pending}
            className={pill}
          >
            {confirming || pending
              ? t('flow.confirming')
              : slot
                ? `${t('flow.confirm')} · ${dayChip(slot, lang)}, ${slotText(slot, lang).time}`
                : t('flow.confirm')}
          </button>
        ) : (
          <button type="button" onClick={sendCode} disabled={Boolean(blocker) || sending} className={pill}>
            {sending ? t('flow.sending') : t('flow.sendCode')}
          </button>
        )}
        {blocker ? <p className="m-0 mt-3 text-[13px] text-[var(--ink2)]">{blocker}</p> : null}
      </section>
    </div>
  );
}

function Step({ n, title, help }: { n: number; title: string; help?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="oi-num flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--ink)] text-[12px] text-white">
        {n}
      </span>
      <div>
        <h2 className="oi-display m-0 text-[clamp(1.2rem,1.05rem+0.6vw,1.5rem)] leading-tight">{title}</h2>
        {help ? <p className="m-0 mt-1 text-[13.5px] text-[var(--ink2)]">{help}</p> : null}
      </div>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="m-0 mt-3 text-[14px]" style={{ color: 'var(--acc-ink)' }}>
      {children}
    </p>
  );
}
