'use client';

import { useActionState, useEffect, useRef } from 'react';
import { CAPS, CONFIGS } from '@/modules/studio-practice/capture-fields';
import { PUNE_LOCALITIES } from '@/modules/brief/types';
import { submitEnquiryAction, type CaptureState } from './actions';

const INITIAL: CaptureState = { status: 'idle' };

/**
 * Six questions, on a phone, from somebody who has not committed to anything.
 *
 * ## Two required fields and four optional ones
 *
 * A stranger will answer three things well and abandon at the seventh. Name
 * and mobile are the two a studio cannot ring back without; the rest makes
 * the callback worth making and is explicitly marked optional, because a
 * form that looks like six obligations gets closed.
 *
 * ## The honeypot
 *
 * `company` is hidden from layout AND from the accessibility tree, and
 * carries `tabIndex={-1}` and `autoComplete="off"` so no real browser or
 * screen reader ever reaches it. A submission that fills it gets the
 * thank-you page and no row — a bot told it failed tries again.
 *
 * `display: none` rather than an off-screen position, deliberately: some
 * bots skip hidden fields but almost all of them fill a visible-in-DOM one,
 * and a person using a screen reader must never meet it.
 */
export function CaptureForm({ slug, studioName }: { slug: string; studioName: string }) {
  const [state, action, pending] = useActionState(submitEnquiryAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  /* Focus the field that was wrong. Without this the error sits above a form
     somebody has already scrolled past on a phone. */
  useEffect(() => {
    if (state.status === 'invalid' && state.field) {
      const el = formRef.current?.elements.namedItem(state.field);
      if (el instanceof HTMLElement) el.focus();
    }
  }, [state]);

  if (state.status === 'ok') {
    return (
      <div className="rounded-[16px] border border-[var(--color-rule)] bg-[var(--card)] px-6 py-8 text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[var(--color-ontrack)] text-white"
        >
          <svg viewBox="0 0 16 16" className="h-5 w-5">
            <path
              d="M3.5 8.5 L6.5 11.5 L12.5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="m-0 mb-1.5 text-[19px] font-bold text-[var(--color-ink)]">Thank you.</h2>
        <p className="m-0 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          {studioName} has your details and will be in touch. If it is urgent, ring them directly.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />

      {/* The honeypot. Never rendered to a person. */}
      <div style={{ display: 'none' }} aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Field id="name" label="Your name" required>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={CAPS.name}
          autoComplete="name"
          className="oi-input w-full rounded-[12px] border border-[var(--color-rule)] px-4 py-3 text-[15.5px] text-[var(--color-ink)]"
        />
      </Field>

      <Field id="phone" label="Mobile number" required hint="So they can call you back.">
        <input
          id="phone"
          name="phone"
          /* `tel`, not `number`. A number input strips leading zeros, refuses
             a `+91`, and on some Android keyboards hides the digits behind a
             spinner. */
          type="tel"
          inputMode="numeric"
          required
          maxLength={CAPS.phone}
          autoComplete="tel"
          className="oi-input w-full rounded-[12px] border border-[var(--color-rule)] px-4 py-3 text-[15.5px] text-[var(--color-ink)]"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="config" label="What is the home" optional>
          <select
            id="config"
            name="config"
            defaultValue=""
            className="oi-input w-full rounded-[12px] border border-[var(--color-rule)] px-4 py-3 text-[15.5px] text-[var(--color-ink)]"
          >
            <option value="">Not sure yet</option>
            {CONFIGS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field id="locality" label="Where" optional>
          {/* A datalist, not a select: sixty options in a dropdown on a phone
              is a scroll nobody finishes, and typing "Ban" narrows it in one
              gesture. Anything unrecognised still reaches the studio — see
              `localitySlug`. */}
          <input
            id="locality"
            name="locality"
            list="oi-localities"
            maxLength={CAPS.locality}
            placeholder="Baner, Kharadi…"
            className="oi-input w-full rounded-[12px] border border-[var(--color-rule)] px-4 py-3 text-[15.5px] text-[var(--color-ink)]"
          />
          <datalist id="oi-localities">
            {PUNE_LOCALITIES.map((l) => (
              <option key={l.slug} value={l.label} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field id="email" label="Email" optional>
        <input
          id="email"
          name="email"
          type="email"
          maxLength={CAPS.email}
          autoComplete="email"
          className="oi-input w-full rounded-[12px] border border-[var(--color-rule)] px-4 py-3 text-[15.5px] text-[var(--color-ink)]"
        />
      </Field>

      <Field id="message" label="Anything you want them to know" optional>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={CAPS.message}
          placeholder="Possession in March, kitchen and two wardrobes to start…"
          className="oi-input w-full resize-y rounded-[12px] border border-[var(--color-rule)] px-4 py-3 text-[15.5px] text-[var(--color-ink)]"
        />
      </Field>

      {state.status === 'invalid' || state.status === 'limited' || state.status === 'error' ? (
        <p
          role="alert"
          className="m-0 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-3 text-[14px] leading-relaxed text-[var(--color-atrisk)]"
        >
          {state.message}
        </p>
      ) : null}

      {state.status === 'closed' ? (
        <p role="alert" className="m-0 text-[14px] text-[var(--color-ink-2)]">
          {studioName} has stopped taking enquiries through this link.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="oi-cta mt-1 flex w-full items-center justify-center gap-2 px-6 py-4 text-[16px] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  required,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-baseline gap-2 text-[14px] font-bold text-[var(--color-ink)]"
      >
        {label}
        {/* "Optional" said on the field rather than a star on the required
            ones. A form marked with asterisks reads as five obligations and
            two exceptions; this reads as two questions and four favours. */}
        {optional ? (
          <span className="text-[12.5px] font-normal text-[var(--color-ink-2)]">optional</span>
        ) : null}
        {required ? <span className="sr-only">(required)</span> : null}
      </label>
      {hint ? <p className="m-0 mb-1.5 text-[12.5px] text-[var(--color-ink-2)]">{hint}</p> : null}
      {children}
    </div>
  );
}
