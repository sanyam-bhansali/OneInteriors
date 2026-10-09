'use client';

/**
 * Asking for the call.
 *
 * ## Why there is a question builder
 *
 * The form used to end with an empty textarea and the encouraging note that
 * "the thing you are actually worried about is the most useful sentence you
 * can write here". That is true, and almost nobody writes it — not because
 * they have no worry, but because a blank box at the end of a form is a
 * homework question, and the honest answer ("I don't know what I don't know")
 * does not fit in it.
 *
 * So the worries are offered as a list, and several of them are generated from
 * this customer's own comparison: if two studios are ₹1.2 L apart, "why is
 * Teakline ₹1.2 L more than Chitra & Co.?" is on the list with the real names
 * and the real figure in it. Ticking is one press; writing that sentence is
 * not.
 *
 * ## Why it composes into `askedAbout` rather than a new column
 *
 * What the architect needs is a paragraph they can read before ringing. The
 * ticked questions and the typed sentence are the same thing — the customer's
 * agenda for the call — and splitting them across two fields would mean two
 * places for ops to look and one of them eventually not being looked at.
 *
 * The composed text is put in a hidden input on submit, and the textarea keeps
 * its own name off the wire so nothing is sent twice.
 */

import { useActionState, useMemo, useState } from 'react';
import { googleCalendarUrl, slotLabel } from '@/modules/consultation/slots';
import { ARCHITECT } from '@/modules/consultation/architect';
import { SlotPicker } from '@/components/SlotPicker';
import { formatINRCompact } from '@/lib/money';
import { Sheet, Tick } from '@/components/oi';
import { requestExpertAction, type ExpertState } from './actions';
import { useLang, useSiteT } from '@/components/app/i18n';
import { EXPERT_DICT, known } from '@/modules/i18n/site/expert';
import type { Lang } from '@/modules/i18n/site';

const INITIAL: ExpertState = { status: 'idle' };

export interface StudioOption {
  id: string;
  name: string;
  lowPaise: number;
  highPaise: number;
}

/**
 * The questions that apply to everybody, in the order they tend to matter.
 *
 * Every one is a real thing people ring us about and a real thing an architect
 * can answer. None of them is a lead-qualification question in disguise.
 */
const STANDARD = ['std.0', 'std.1', 'std.2', 'std.3', 'std.4', 'std.5'] as const;

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

export function ExpertForm({
  briefId,
  studios,
  defaultName,
  defaultEmail,
  minStudios,
  maxStudios,
  slots = [],
  preselected = [],
  fromBrief = [],
  initialSlot = null,
}: {
  briefId: string;
  studios: StudioOption[];
  defaultName: string | null;
  defaultEmail: string | null;
  minStudios: number;
  maxStudios: number;
  /** Open 30-minute slots (ISO). Empty when no expert has hours set — then we ask when suits them. */
  slots?: string[];
  /** The studios they compared — ticked for them. */
  preselected?: string[];
  /** Questions from their possession, household and needs (consultation/brief-questions.ts). */
  fromBrief?: string[];
  /** A slot already picked in the app (/app/expert), kept only if it is still open. */
  initialSlot?: string | null;
}) {
  const t = useSiteT(EXPERT_DICT);
  const lang = useLang();
  const [state, action, pending] = useActionState(requestExpertAction, INITIAL);
  const [slot, setSlot] = useState<string | null>(initialSlot && slots.includes(initialSlot) ? initialSlot : null);
  const booking = slots.length > 0;
  const [picked, setPicked] = useState<string[]>(
    preselected.length > 0 ? preselected.slice(0, maxStudios) : studios.slice(0, 2).map((s) => s.id),
  );
  const [asks, setAsks] = useState<string[]>([]);
  const [own, setOwn] = useState('');
  const err = state.errors ?? {};

  /**
   * Questions written out of this customer's own numbers.
   *
   * Generated rather than canned, so the list opens with the thing they were
   * already wondering — with both studios named and the gap in rupees.
   */
  const generated = useMemo((): { id: string; q: string }[] => {
    if (studios.length < 2) return [];
    const byMid = [...studios].sort(
      (a, b) => (a.lowPaise + a.highPaise) / 2 - (b.lowPaise + b.highPaise) / 2,
    );
    const low = byMid[0]!;
    const high = byMid[byMid.length - 1]!;
    const gap = (high.lowPaise + high.highPaise) / 2 - (low.lowPaise + low.highPaise) / 2;
    if (gap <= 0) return [];
    return [
      { id: 'gen.why', q: t('gen.why', { high: high.name, gap: formatINRCompact(Math.round(gap)), low: low.name }) },
      { id: 'gen.leaving', q: t('gen.leaving', { low: low.name }) },
    ];
  }, [studios, t]);

  /** Every question on offer, by id: the ticked ones are kept as ids so a language change keeps them. */
  const questionText = new Map<string, string>([
    ...generated.map((g) => [g.id, g.q] as [string, string]),
    ...fromBrief.map((q) => [`brief:${q}`, q] as [string, string]),
    ...STANDARD.map((k) => [k, t(k)] as [string, string]),
  ]);
  const askedTexts = asks.map((id) => questionText.get(id) ?? id);

  /** Ticked questions first, then whatever they wrote. One paragraph for ops. */
  const composed = [
    ...askedTexts.map((q) => `• ${q}`),
    own.trim() ? `\n${own.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000);

  if (state.status === 'sent') {
    const when = state.scheduledFor ? slotText(state.scheduledFor, lang) : null;
    return (
      <Sheet className="p-[clamp(22px,3vw,34px)]">
        <p className="oi-eyebrow m-0 mb-4">{when ? t('sent.booked') : t('sent.requested')}</p>
        <h2 className="oi-display m-0 mb-4 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]">
          {when ? t('sent.when', { day: when.day, time: when.time }) : t('sent.weCall')}
        </h2>
        <p className="m-0 mb-3 max-w-[58ch] text-[15px] leading-[1.65] text-[var(--ink2)]">
          {when
            ? t('sent.bookedBody')
            : t('sent.requestedBody')}
        </p>
        {/* Who, and the agenda — their own questions, in their order — so the
            call reads as a working session they set, not a sales call
            (principle 9, docs/UX-PRINCIPLES-PLAN.md; Superhuman, Calendly). */}
        <p className="m-0 mb-5 text-[15px] text-[var(--ink)]">
          {t('sent.with')} <strong className="font-semibold">{ARCHITECT.name}</strong> · {known(lang, 'architect.role', ARCHITECT.role)}
        </p>
        {asks.length > 0 || own.trim() ? (
          <div className="mb-6 rounded-[18px] bg-[var(--card)] p-5">
            <p className="oi-label m-0 mb-3">{t('sent.agenda')}</p>
            <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-[1.5] text-[var(--ink)]">
              {askedTexts.map((q) => (
                <li key={q}>{q}</li>
              ))}
              {own.trim() ? <li>{own.trim()}</li> : null}
            </ol>
            <p className="m-0 mt-3 text-[13.5px] text-[var(--ink2)]">
              {t('sent.agendaNote')}
            </p>
          </div>
        ) : null}
        {state.scheduledFor ? (
          <p className="m-0 mb-6">
            <a
              href={googleCalendarUrl({
                startsAt: state.scheduledFor,
                title: t('cal.title', { name: ARCHITECT.name }),
                details: [
                  t('cal.details'),
                  ...askedTexts.map((q) => `• ${q}`),
                  own.trim() ? `• ${own.trim()}` : '',
                ]
                  .filter(Boolean)
                  .join('\n'),
              })}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-5 text-[14px] font-medium text-[var(--ink)] no-underline hover:border-[var(--ink)]"
            >
              {t('cal.add')}
            </a>
          </p>
        ) : null}

        {/* The reason this screen is not the end of the page.
            A confirmation with nothing after it is a dead end at the highest-
            intent moment we ever get — they have just handed over a phone
            number, and the next thing they do is go and fill in somebody
            else's form, because waiting is not an activity. The prep pack is
            the activity, and it makes their own call better, which is the only
            honest reason to offer it. */}
        <div className="border-t border-[var(--line)] pt-6">
          <p className="m-0 mb-5 max-w-[58ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
            {t('prep.body')}
          </p>
          <a
            href="/account#rooms"
            className="oi-cta inline-flex min-h-11 items-center px-6 py-3 text-[14.5px] no-underline"
          >
            {t('prep.cta')}
          </a>
          <p className="m-0 mt-4 text-[13px] text-[var(--ink2)]">
            {t('prep.note')}
          </p>
        </div>
      </Sheet>
    );
  }

  const toggleStudio = (id: string) =>
    setPicked((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length < maxStudios
          ? [...prev, id]
          : prev,
    );

  const toggleAsk = (q: string) =>
    setAsks((prev) => (prev.includes(q) ? prev.filter((a) => a !== q) : [...prev, q]));

  return (
    <form action={action} className="flex flex-col gap-10">
      <input type="hidden" name="briefId" value={briefId} />
      <input type="hidden" name="askedAbout" value={composed} />

      {/* ── Which studios ── */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="oi-display mb-2 p-0 text-[21px]">
          {t('studios.legend')}
        </legend>
        <p className="m-0 mb-5 max-w-[56ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
          {t('studios.help', { min: minStudios, max: maxStudios })}
        </p>

        {err.studioIds ? (
          <p role="alert" className="m-0 mb-3 text-[14px]" style={{ color: 'var(--acc-ink)' }}>
            {err.studioIds}
          </p>
        ) : null}

        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {studios.map((studio) => {
            const checked = picked.includes(studio.id);
            return (
              <li key={studio.id}>
                <label
                  className="flex min-h-11 cursor-pointer items-center justify-between gap-4 border px-5 py-3.5"
                  style={{
                    borderColor: checked ? 'var(--ink2)' : 'var(--line)',
                    background: checked ? 'var(--acc-wash)' : 'var(--card)',
                  }}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="studioIds"
                      value={studio.id}
                      checked={checked}
                      onChange={() => toggleStudio(studio.id)}
                      className="h-4 w-4 accent-[var(--acc)]"
                    />
                    <span className="text-[15px]">{studio.name}</span>
                  </span>
                  <span className="oi-num text-[12.5px] text-[var(--ink2)]">
                    {formatINRCompact(studio.lowPaise)}–{formatINRCompact(studio.highPaise)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {/* ── What you want answered ── */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="oi-display mb-2 p-0 text-[21px]">{t('asks.legend')}</legend>
        <p className="m-0 mb-5 max-w-[56ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
          {t('asks.help')}
        </p>

        {/* ── The two that came from their own numbers ──
            Separated from the canned list, and labelled, because they are not
            the same kind of thing. "Why is Teakline about ₹1.2 L more than
            Chitra & Co.?" is the question the customer has already been
            asking themselves since the compare screen, with both studios named
            and the gap in rupees — computed from their quotes, not written by
            us and hoping to land.

            They were mixed into the standard list wearing a 10px grey caption.
            A question we derived from this person's own spread is the single
            most persuasive thing on the page, and it read as a footnote. */}
        {generated.length > 0 ? (
          <div className="mb-5">
            <p className="oi-eyebrow m-0 mb-3">{t('asks.fromQuotes')}</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {generated.map((g) => (
                <li key={g.id}>
                  <Ask q={g.q} on={asks.includes(g.id)} onToggle={() => toggleAsk(g.id)} derived />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* From their life rather than their quotes — the timeline, the family,
            what the home needs (build queue item 9). */}
        {fromBrief.length > 0 ? (
          <div className="mb-5">
            <p className="oi-eyebrow m-0 mb-3">{t('asks.fromBrief')}</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {fromBrief.map((q) => (
                <li key={q}>
                  <Ask q={q} on={asks.includes(`brief:${q}`)} onToggle={() => toggleAsk(`brief:${q}`)} derived />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {generated.length > 0 || fromBrief.length > 0 ? (
          <p className="oi-eyebrow m-0 mb-3">{t('asks.common')}</p>
        ) : null}

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {STANDARD.map((k) => (
            <li key={k}>
              <Ask q={t(k)} on={asks.includes(k)} onToggle={() => toggleAsk(k)} />
            </li>
          ))}
        </ul>

        <div className="mt-5">
          <label htmlFor="ownQuestion" className="oi-label mb-2 block">
            {t('asks.own')}
          </label>
          <textarea
            id="ownQuestion"
            rows={3}
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            placeholder={t('asks.ownPlaceholder')}
            className="w-full border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-[14.5px] leading-[1.6] text-[var(--ink)] placeholder:text-[var(--ink2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--acc)]"
          />
        </div>
      </fieldset>

      {/* ── How we reach you ── */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="oi-display mb-2 p-0 text-[21px]">{t('reach.legend')}</legend>
        <p className="m-0 mb-5 max-w-[56ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
          {t('reach.help')}
        </p>

        <div className="flex flex-col gap-5">
          <Field
            label={t('field.name')}
            name="contactName"
            required
            defaultValue={defaultName}
            error={err.contactName}
            optionalText={t('field.optional')}
          />
          <Field
            label={t('field.mobile')}
            name="contactPhone"
            type="tel"
            required
            error={err.contactPhone}
            optionalText={t('field.optional')}
            placeholder="98765 43210"
          />
          <Field
            label={t('field.email')}
            name="contactEmail"
            type="email"
            defaultValue={defaultEmail}
            error={err.contactEmail}
            optionalText={t('field.optional')}
          />
          {booking ? null : (
            <Field
              label={t('field.when')}
              name="preferredTimes"
              placeholder={t('field.whenPlaceholder')}
              optionalText={t('field.optional')}
            />
          )}
        </div>
      </fieldset>

      {booking ? (
        <fieldset className="m-0 border-0 p-0">
          <legend className="oi-eyebrow m-0 mb-1 p-0">{t('slot.legend')}</legend>
          <p className="m-0 mb-4 text-[13.5px] text-[var(--ink2)]">
            {t('slot.help')}
          </p>
          <SlotPicker slots={slots} value={slot} onPick={setSlot} />
          <input type="hidden" name="startsAt" value={slot ?? ''} />
          {err.startsAt ? (
            <p role="alert" className="m-0 mt-3 text-[14px]" style={{ color: 'var(--acc-ink)' }}>
              {err.startsAt}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {/* Asked here, where they pick the studios, because this is what they
          are agreeing to (plan §3.3). Required: an introduction without it
          could never tell the studio who to meet. */}
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="shareConsent" required className="mt-1 h-4 w-4 flex-none accent-[var(--acc)]" />
        <span className="text-[14.5px] leading-snug text-[var(--ink)]">
          {t('consent.label')}
          <span className="mt-1 block text-[13px] text-[var(--ink2)]">
            {t('consent.withdraw')}
          </span>
        </span>
      </label>
      {err.shareConsent ? (
        <p role="alert" className="m-0 -mt-3 text-[13.5px]" style={{ color: 'var(--acc-ink)' }}>
          {err.shareConsent}
        </p>
      ) : null}

      <div className="border-t border-[var(--line)] pt-7">
        {err.form ? (
          <p
            role="alert"
            className="m-0 mb-4 border-l-2 px-4 py-2.5 text-[14.5px]"
            style={{ borderColor: 'var(--acc)', color: 'var(--acc-ink)' }}
          >
            {err.form}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || picked.length < minStudios || (booking && !slot)}
          className="oi-cta min-h-11 cursor-pointer border-0 px-7 py-3.5 text-[15px] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending
            ? booking
              ? t('submit.booking')
              : t('submit.sending')
            : booking
              ? slot
                ? t('submit.book', { day: slotText(slot, lang).day.split(' ')[0]!, time: slotText(slot, lang).time })
                : t('submit.pick')
              : t('submit.request')}
        </button>
        <p className="m-0 mt-5 max-w-[58ch] text-[13.5px] leading-[1.6] text-[var(--ink2)]">
          {t('submit.note')}
        </p>
      </div>
    </form>
  );
}

/**
 * One question the customer can hand to the architect.
 *
 * `derived` marks the ones computed from this customer's own quote spread
 * rather than written by us. It gets a sage rule down its left edge and the
 * label sits above the group rather than inside each row: a badge on every
 * item in a group of two says the same thing twice and competes with the
 * question itself, which is the part worth reading.
 *
 * Both states are a shape as well as a colour — a tick or an empty ring — per
 * docs/DESIGN-LANGUAGE.md §4.4. Sage is verification and better-spec here,
 * never an action, so the button that submits is terracotta and these are not.
 */
function Ask({
  q,
  on,
  onToggle,
  derived = false,
}: {
  q: string;
  on: boolean;
  onToggle: () => void;
  derived?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="flex min-h-11 w-full cursor-pointer items-start gap-3 border px-4 py-3 text-left text-[14px] leading-snug transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--acc)]"
      style={{
        borderColor: on ? 'var(--sec)' : 'var(--line)',
        background: on ? 'rgba(131,144,115,.09)' : 'var(--card)',
        borderLeftWidth: derived ? 3 : 1,
        borderLeftColor: derived ? 'var(--sec)' : on ? 'var(--sec)' : 'var(--line)',
      }}
    >
      <span className="flex h-[19px] flex-none items-center">
        {on ? (
          <Tick style={{ color: 'var(--sec)' }} />
        ) : (
          <span
            aria-hidden
            className="h-[13px] w-[13px] rounded-full border"
            style={{ borderColor: 'var(--line)' }}
          />
        )}
      </span>
      <span className="min-w-0">{q}</span>
    </button>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  defaultValue,
  error,
  placeholder,
  optionalText = ' — optional',
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | null;
  error?: string;
  placeholder?: string;
  /** " — optional", in the visitor's language. */
  optionalText?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="oi-label mb-2 block">
        {label}
        {required ? '' : optionalText}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="w-full border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--acc)]"
      />
      {error ? (
        <p role="alert" className="m-0 mt-1.5 text-[13.5px]" style={{ color: 'var(--acc-ink)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
