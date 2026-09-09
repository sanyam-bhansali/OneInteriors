'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui';
import { requestSignInLink, type SignInState } from './actions';

const INITIAL: SignInState = { status: 'idle' };

export function SignInForm({ next }: { next?: string | null }) {
  const [state, action, pending] = useActionState(requestSignInLink, INITIAL);

  if (state.status === 'sent') {
    return (
      <div className="rounded-[10px] border border-[var(--color-ontrack)] bg-[var(--color-ontrack-soft)] p-5">
        <p className="m-0 mb-1 text-[15px] font-bold text-[var(--color-ink)]">Check your email</p>
        <p className="m-0 text-[14.5px] leading-relaxed text-[var(--color-ink-2)]">
          {state.message}
        </p>

        {/* Development only. In production the link is never returned to the
            browser — it exists in the email and nowhere else. */}
        {state.devLink ? (
          <div className="mt-4 border-t border-[var(--color-ontrack)] pt-3">
            <p className="label m-0 mb-1.5">No email provider configured — dev link</p>
            <a
              href={state.devLink}
              className="break-all font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-petrol)]"
            >
              {state.devLink}
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Rides along into the emailed link so the customer returns to the step
          they were on rather than the homepage. */}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label
          htmlFor="email"
          className="label m-0 mb-2 block"
        >
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="you@example.com"
          aria-describedby={state.status === 'error' ? 'signin-error' : undefined}
          aria-invalid={state.status === 'error'}
          className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)]"
        />
      </div>

      {state.status === 'error' ? (
        <p
          id="signin-error"
          role="alert"
          className="m-0 text-[14px] text-[var(--color-atrisk)]"
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Sending…' : 'Email me a link'}
      </Button>
    </form>
  );
}
