'use client';

import { useActionState, useState } from 'react';
import { savePaymentPhasesAction, type StepState } from './actions';
import { Field, SaveBar } from './fields';
import { advanceIsHigh, checkPhases, parsePhasesText } from '@/modules/studio/payment-phases';

const INITIAL: StepState = { status: 'idle' };

/**
 * When you are paid — printed on every quote a customer gets for you.
 *
 * One line, in the words a studio already writes at the foot of its
 * quotations, because that is the form this information exists in. It is
 * read back as it is typed, so a schedule that adds up to 90% is caught here
 * rather than on a customer's quote.
 *
 * Optional, and it blocks nothing: until it is filed, the quote says the
 * schedule is still to come.
 */
export function PaymentPhasesForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState(savePaymentPhasesAction, INITIAL);
  const [text, setText] = useState(initial);

  const phases = text.trim() ? parsePhasesText(text) : null;
  const problem = phases ? checkPhases(phases) : null;

  return (
    <form
      action={action}
      className="oi-sec rounded-[16px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-6 py-5"
    >
      <p className="m-0 text-[15.5px] font-semibold text-[var(--color-ink)]">When you are paid</p>
      <p className="m-0 mb-4 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
        Your payment schedule, as you write it on your quotations. It is printed on every quote a
        customer gets for you, in rupees on their total.
      </p>

      <div onChange={(e) => setText((e.target as HTMLInputElement).value)}>
        <Field
          label="Payment phases"
          name="paymentPhases"
          defaultValue={initial}
          placeholder="10% booking, 40% design sign-off, 40% material delivery, 10% handover"
          error={state.errors?.paymentPhases}
        />
      </div>

      {phases && phases.length > 0 ? (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
          {phases.map((p, i) => (
            <li
              key={`${p.label}-${i}`}
              className="rounded-full bg-[var(--color-paper-2)] px-3 py-1 text-[13px] text-[var(--color-ink)]"
            >
              <span className="font-[family-name:var(--font-mono)] tabular-nums">{p.pct}%</span> {p.label}
            </li>
          ))}
        </ul>
      ) : null}
      {text.trim() && !phases ? (
        <p className="m-0 mt-2 text-[13px] text-[var(--color-ink-2)]">
          Give every phase a percentage, separated by commas.
        </p>
      ) : null}
      {problem ? <p className="m-0 mt-2 text-[13px] text-[var(--color-atrisk)]">{problem}</p> : null}
      {phases && !problem && advanceIsHigh(phases) ? (
        <p className="m-0 mt-2 text-[13px] text-[var(--color-ink-2)]">
          Customers see that this asks more than 30% at booking — most studios in Pune ask less.
        </p>
      ) : null}

      <SaveBar
        pending={pending}
        saved={state.status === 'saved'}
        formError={state.errors?.form}
        label="Save payment phases"
      />
    </form>
  );
}
