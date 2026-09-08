'use client';

import { useActionState } from 'react';
import { submitForReviewAction, type StepState } from './actions';

const INITIAL: StepState = { status: 'idle' };

export function ReviewPanel({
  ready,
  alreadySubmitted,
  missing,
}: {
  ready: boolean;
  alreadySubmitted: boolean;
  missing: string[];
}) {
  const [state, action, pending] = useActionState(submitForReviewAction, INITIAL);

  if (alreadySubmitted || state.status === 'saved') {
    return (
      <div className="rounded-[14px] border border-[var(--color-ontrack)] bg-[var(--color-ontrack-soft)] p-7">
        <h2 className="h2 mb-3">It is with us.</h2>
        <p className="m-0 mb-3 text-[16px] leading-relaxed text-[var(--color-ink-2)]">
          We will call you within a week. Between now and then we check company records and GST
          filing history, call two past clients, and visit two completed sites.
        </p>
        <p className="m-0 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
          You can keep editing anything — nothing is locked. And you will see your finished profile
          and approve it before a single customer does.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="m-0 mb-4 max-w-[62ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
          When you send this to us, four things happen — none of them make you visible to
          customers yet:
        </p>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          <Step n="01" body="We check your registration against the public GST and company records." />
          <Step n="02" body="We call two of your past clients. We will ask you who, and we will tell you what we ask them." />
          <Step n="03" body="We visit two completed sites. In person, unannounced only if you agree to that." />
          <Step n="04" body="You see the finished profile and approve every word of it. Then you go live." />
        </ol>
      </div>

      <div className="rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-3)] p-6">
        <p className="label m-0 mb-2">What we will publish about you later</p>
        <p className="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          Once you have delivered projects through us, your profile carries the average number of
          days past your own committed date, and any dispute upheld against you. That is the deal,
          and it is worth saying plainly before you commit rather than after. It cuts both ways —
          it is also the reason a customer believes the good numbers.
        </p>
      </div>

      {!ready ? (
        <p className="m-0 rounded-[10px] bg-[var(--color-paper-3)] px-5 py-4 text-[14.5px] text-[var(--color-ink-2)]">
          Still to finish: {missing.join(', ')}.
        </p>
      ) : null}

      <form action={action} className="border-t border-[var(--color-rule)] pt-6">
        {state.status === 'error' ? (
          <p role="alert" className="m-0 mb-3 rounded-[10px] bg-[var(--color-atrisk-soft)] px-4 py-2.5 text-[14.5px] text-[var(--color-atrisk)]">
            {state.errors?.form}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || !ready}
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-petrol)] px-7 py-3.5 text-[15px] font-medium text-[var(--color-paper)] transition-colors hover:bg-[var(--color-petrol-deep)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Sending…' : 'Send for verification'}
        </button>
      </form>
    </div>
  );
}

function Step({ n, body }: { n: string; body: string }) {
  return (
    <li className="grid grid-cols-[30px_minmax(0,1fr)] gap-3">
      <span className="tabular font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[var(--color-petrol)]">
        {n}
      </span>
      <span className="text-[15px] leading-relaxed text-[var(--color-ink-2)]">{body}</span>
    </li>
  );
}
