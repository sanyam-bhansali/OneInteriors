'use client';

import { useState } from 'react';
import { QUIZ_PURPOSES, PURPOSE_NOTICE, isBlocking, type ConsentPurpose } from '@/modules/consent/policy';

/**
 * The consent notice.
 *
 * Three things here are load-bearing under the DPDP Act, and all three are the
 * opposite of what most Indian sites do:
 *
 *  1. **Nothing starts ticked.** Consent needs a clear affirmative action, and
 *     a pre-ticked box is not one.
 *  2. **Marketing is never required.** The submit button is enabled on the one
 *     purpose we genuinely cannot deliver the service without. Declining email
 *     and WhatsApp costs the person nothing, and the copy says so.
 *  3. **Each purpose is separate.** One tick may not cover email, WhatsApp and
 *     SMS together.
 *
 * It is also written to be read. A notice nobody understands is not informed
 * consent, whatever the checkbox says.
 */
export function ConsentGate({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (granted: ConsentPurpose[]) => void;
  submitting?: boolean;
  error?: string;
}) {
  const [granted, setGranted] = useState<ConsentPurpose[]>([]);

  const blockingSatisfied = QUIZ_PURPOSES.filter(isBlocking).every((p) => granted.includes(p));

  function toggle(purpose: ConsentPurpose) {
    setGranted((prev) =>
      prev.includes(purpose) ? prev.filter((p) => p !== purpose) : [...prev, purpose],
    );
  }

  return (
    <div className="rounded-[14px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-6">
      <p className="label m-0 mb-2">Before we introduce you</p>
      <p className="m-0 mb-5 max-w-[58ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
        We only pass on what a studio needs to answer you properly — your area, budget range, scope
        and style. Not your name or number until you decide to send an enquiry.
      </p>

      <div className="flex flex-col gap-4">
        {QUIZ_PURPOSES.map((purpose) => {
          const notice = PURPOSE_NOTICE[purpose];
          const required = isBlocking(purpose);
          return (
            <label key={purpose} className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={granted.includes(purpose)}
                onChange={() => toggle(purpose)}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-petrol)]"
              />
              <span className="min-w-0">
                <span className="block text-[15px] leading-snug text-[var(--color-ink)]">
                  {notice.label}
                  {required ? (
                    <span className="ml-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                      Needed
                    </span>
                  ) : (
                    <span className="ml-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                      Optional
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[13.5px] leading-snug text-[var(--color-ink-3)]">
                  {notice.detail}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="m-0 mt-4 text-[14px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : null}

      <div className="mt-6 border-t border-[var(--color-rule)] pt-5">
        <button
          type="button"
          onClick={() => onSubmit(granted)}
          disabled={submitting || !blockingSatisfied}
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-petrol)] px-7 py-3.5 text-[15px] font-medium text-[var(--color-paper)] hover:bg-[var(--color-petrol-deep)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Saving…' : 'Agree and continue'}
        </button>

        <p className="m-0 mt-4 max-w-[58ch] text-[13px] leading-relaxed text-[var(--color-ink-3)]">
          The two optional boxes change nothing about your matches — leave them unticked and you
          will see exactly the same studios. You can withdraw any of this later, and it takes one
          click, not an email to support.
        </p>
      </div>
    </div>
  );
}
