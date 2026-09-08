'use client';

import { useActionState, useState } from 'react';
import { formatINRCompact } from '@/lib/money';
import { requestExpertAction, type ExpertState } from './actions';

const INITIAL: ExpertState = { status: 'idle' };

export interface StudioOption {
  id: string;
  name: string;
  lowPaise: number;
  highPaise: number;
}

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
  const err = state.errors ?? {};

  if (state.status === 'sent') {
    return (
      <div className="rounded-[16px] border border-[var(--color-ontrack)] bg-[var(--color-ontrack-soft)] p-7">
        <h2 className="h2 mb-3">We&rsquo;ll call you.</h2>
        <p className="m-0 mb-3 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
          Someone will be in touch within one working day to fix a time. Before the call they will
          read your brief, your floor plan and every quote on your comparison — you will not have
          to explain any of it again.
        </p>
        <p className="m-0 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          On the call we go through the studios you picked and help you choose one. If it is clear
          none of them fits, we will say that too, and go back to the roster.
        </p>
      </div>
    );
  }

  function toggle(id: string) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < maxStudios ? [...prev, id] : prev,
    );
  }

  return (
    <form action={action} className="flex flex-col gap-9">
      <input type="hidden" name="briefId" value={briefId} />

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 p-0 font-[family-name:var(--font-display)] text-[24px] leading-tight">
          Which studios do you want to talk about?
        </legend>
        <p className="m-0 mb-5 max-w-[56ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
          Pick between {minStudios} and {maxStudios}. Our expert reads all of them before the call,
          so choosing fewer means a deeper conversation about each.
        </p>

        {err.studioIds ? (
          <p role="alert" className="m-0 mb-3 text-[14px] text-[var(--color-atrisk)]">
            {err.studioIds}
          </p>
        ) : null}

        <div className="flex flex-col gap-2.5">
          {studios.map((studio) => {
            const checked = picked.includes(studio.id);
            return (
              <label
                key={studio.id}
                className={`flex cursor-pointer items-center justify-between gap-4 rounded-[12px] border px-5 py-4 ${
                  checked
                    ? 'border-[var(--color-petrol)] bg-[var(--color-petrol-soft)]'
                    : 'border-[var(--color-rule)] bg-[var(--color-paper-2)]'
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="studioIds"
                    value={studio.id}
                    checked={checked}
                    onChange={() => toggle(studio.id)}
                    className="h-4 w-4 accent-[var(--color-petrol)]"
                  />
                  <span className="text-[16px] text-[var(--color-ink)]">{studio.name}</span>
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[12.5px] tabular-nums text-[var(--color-ink-3)]">
                  {formatINRCompact(studio.lowPaise)}–{formatINRCompact(studio.highPaise)}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 p-0 font-[family-name:var(--font-display)] text-[24px] leading-tight">
          How do we reach you?
        </legend>
        <p className="m-0 mb-5 max-w-[56ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
          A phone number, because this is a call. We do not pass it to any studio — the
          introduction happens after the call, and only to the one you choose.
        </p>

        <div className="flex flex-col gap-5">
          <Field label="Your name" name="contactName" required defaultValue={defaultName} error={err.contactName} />
          <Field
            label="Mobile"
            name="contactPhone"
            type="tel"
            required
            error={err.contactPhone}
            placeholder="98765 43210"
          />
          <Field label="Email" name="contactEmail" type="email" defaultValue={defaultEmail} error={err.contactEmail} />
          <Field
            label="When suits you?"
            name="preferredTimes"
            placeholder="Weekday evenings, or Saturday morning"
          />
        </div>
      </fieldset>

      <div>
        <label htmlFor="askedAbout" className="label m-0 mb-2 block">
          Anything you want us to look at before the call? — optional
        </label>
        <p className="m-0 mb-2 max-w-[56ch] text-[13.5px] leading-snug text-[var(--color-ink-3)]">
          The thing you are actually worried about is the most useful sentence you can write here.
        </p>
        <textarea
          id="askedAbout"
          name="askedAbout"
          rows={4}
          placeholder="One quote is much cheaper on the kitchen and I do not understand why. Also we have a two-year-old, so timeline matters more than finish."
          className="w-full rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-4 text-[15.5px] leading-relaxed"
        />
      </div>

      <div className="border-t border-[var(--color-rule)] pt-7">
        {err.form ? (
          <p role="alert" className="m-0 mb-3 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-2.5 text-[14.5px] text-[var(--color-atrisk)]">
            {err.form}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || picked.length < minStudios}
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-petrol)] px-7 py-3.5 text-[15px] font-medium text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Sending…' : 'Request the call'}
        </button>
        <p className="m-0 mt-4 max-w-[56ch] text-[13.5px] leading-relaxed text-[var(--color-ink-3)]">
          Free, and there is nothing to buy on the call. We are paid by the studio if you go ahead
          with one — which is why we would rather tell you none of them fits than push you into a
          project you regret.
        </p>
      </div>
    </form>
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
      <label htmlFor={name} className="label m-0 mb-2 block">
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
        className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)]"
      />
      {error ? (
        <p role="alert" className="m-0 mt-1.5 text-[13.5px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
