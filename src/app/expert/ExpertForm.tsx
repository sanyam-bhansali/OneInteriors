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
import { formatINRCompact } from '@/lib/money';
import { Sheet, Tick } from '@/components/oi';
import { requestExpertAction, type ExpertState } from './actions';

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
const STANDARD = [
  'Is the cheapest quote cheaper because it is worse, or because it is smaller?',
  'Which lines in these quotes are the ones that usually grow on site?',
  'What happens to the price if the work runs past the agreed weeks?',
  'Which of these studios has actually delivered a flat like mine?',
  'Can I keep some of what I already have, and does that save anything real?',
  'What do I have to decide before work starts, and what can wait?',
];

export function ExpertForm({
  briefId,
  studios,
  defaultName,
  defaultEmail,
  minStudios,
  maxStudios,
}: {
  briefId: string;
  studios: StudioOption[];
  defaultName: string | null;
  defaultEmail: string | null;
  minStudios: number;
  maxStudios: number;
}) {
  const [state, action, pending] = useActionState(requestExpertAction, INITIAL);
  const [picked, setPicked] = useState<string[]>(studios.slice(0, 2).map((s) => s.id));
  const [asks, setAsks] = useState<string[]>([]);
  const [own, setOwn] = useState('');
  const err = state.errors ?? {};

  /**
   * Questions written out of this customer's own numbers.
   *
   * Generated rather than canned, so the list opens with the thing they were
   * already wondering — with both studios named and the gap in rupees.
   */
  const generated = useMemo(() => {
    if (studios.length < 2) return [];
    const byMid = [...studios].sort(
      (a, b) => (a.lowPaise + a.highPaise) / 2 - (b.lowPaise + b.highPaise) / 2,
    );
    const low = byMid[0]!;
    const high = byMid[byMid.length - 1]!;
    const gap = (high.lowPaise + high.highPaise) / 2 - (low.lowPaise + low.highPaise) / 2;
    if (gap <= 0) return [];
    return [
      `Why is ${high.name} about ${formatINRCompact(Math.round(gap))} more than ${low.name}?`,
      `Is ${low.name} leaving something out, or are they genuinely cheaper?`,
    ];
  }, [studios]);

  /** Ticked questions first, then whatever they wrote. One paragraph for ops. */
  const composed = [
    ...asks.map((q) => `• ${q}`),
    own.trim() ? `\n${own.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000);

  if (state.status === 'sent') {
    return (
      <Sheet className="p-[clamp(22px,3vw,34px)]">
        <p className="oi-eyebrow m-0 mb-4">Requested</p>
        <h2 className="oi-display m-0 mb-4 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]">
          We&rsquo;ll call you.
        </h2>
        <p className="m-0 mb-3 max-w-[58ch] text-[15px] leading-[1.65] text-[var(--ink2)]">
          Someone will be in touch within one working day to fix a time. Before the call they will
          read your brief, your floor plan and every quote on your comparison — you will not have
          to explain any of it again.
        </p>
        {asks.length > 0 ? (
          <p className="m-0 mb-6 max-w-[58ch] text-[15px] leading-[1.65] text-[var(--ink2)]">
            They will come to the call with your {asks.length} question
            {asks.length === 1 ? '' : 's'} already looked into, so the call starts at the answer
            rather than at the question.
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
            While you wait, go through your home room by room — what each one costs, and the one
            decision in each that moves the number. The calls that go well are the ones where you
            already know which three things you are choosing between.
          </p>
          <a
            href="/prepare"
            className="oi-cta inline-flex min-h-11 items-center px-6 py-3 text-[14.5px] no-underline"
          >
            Prepare for the call
          </a>
          <p className="m-0 mt-4 text-[13px] text-[var(--ink2)]">
            About fifteen minutes. Entirely optional, and your call is booked either way.
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
          Which studios do you want to talk about?
        </legend>
        <p className="m-0 mb-5 max-w-[56ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
          Pick between {minStudios} and {maxStudios}. Your architect reads all of them before the
          call, so choosing fewer means a deeper conversation about each.
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
        <legend className="oi-display mb-2 p-0 text-[21px]">What do you want answered?</legend>
        <p className="m-0 mb-5 max-w-[56ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
          Tick anything you want looked into before the call. The first two are written from your
          own comparison. Nobody is going to open with &ldquo;so, tell me about your
          requirement&rdquo;.
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
            <p className="oi-eyebrow m-0 mb-3">From your own quotes</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {generated.map((q) => (
                <li key={q}>
                  <Ask q={q} on={asks.includes(q)} onToggle={() => toggleAsk(q)} derived />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {generated.length > 0 ? (
          <p className="oi-eyebrow m-0 mb-3">Things most people ask</p>
        ) : null}

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {STANDARD.map((q) => (
            <li key={q}>
              <Ask q={q} on={asks.includes(q)} onToggle={() => toggleAsk(q)} />
            </li>
          ))}
        </ul>

        <div className="mt-5">
          <label htmlFor="ownQuestion" className="oi-label mb-2 block">
            Anything else — optional
          </label>
          <textarea
            id="ownQuestion"
            rows={3}
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            placeholder="We have a two-year-old, so timeline matters more to us than finish."
            className="w-full border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-[14.5px] leading-[1.6] text-[var(--ink)] placeholder:text-[var(--ink2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--acc)]"
          />
        </div>
      </fieldset>

      {/* ── How we reach you ── */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="oi-display mb-2 p-0 text-[21px]">How do we reach you?</legend>
        <p className="m-0 mb-5 max-w-[56ch] text-[14.5px] leading-[1.6] text-[var(--ink2)]">
          A phone number, because this is a call. We do not pass it to any studio — the
          introduction happens after the call, and only to the one you choose.
        </p>

        <div className="flex flex-col gap-5">
          <Field
            label="Your name"
            name="contactName"
            required
            defaultValue={defaultName}
            error={err.contactName}
          />
          <Field
            label="Mobile"
            name="contactPhone"
            type="tel"
            required
            error={err.contactPhone}
            placeholder="98765 43210"
          />
          <Field
            label="Email"
            name="contactEmail"
            type="email"
            defaultValue={defaultEmail}
            error={err.contactEmail}
          />
          <Field
            label="When suits you?"
            name="preferredTimes"
            placeholder="Weekday evenings, or Saturday morning"
          />
        </div>
      </fieldset>

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
          disabled={pending || picked.length < minStudios}
          className="oi-cta min-h-11 cursor-pointer border-0 px-7 py-3.5 text-[15px] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Sending…' : 'Request the call'}
        </button>
        <p className="m-0 mt-5 max-w-[58ch] text-[13.5px] leading-[1.6] text-[var(--ink2)]">
          Free, and there is nothing to buy on the call. We are paid by the studio if you go ahead
          with one — which is why we would rather tell you none of them fits than push you into a
          project you regret.
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
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | null;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="oi-label mb-2 block">
        {label}
        {required ? '' : ' — optional'}
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
