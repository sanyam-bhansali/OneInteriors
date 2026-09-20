'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui';
import { signInWithPasswordAction, type PasswordState } from './actions';

const INITIAL: PasswordState = { status: 'idle' };

/**
 * Email and password, for ops accounts.
 *
 * ## Why this is collapsed by default
 *
 * Almost everyone who reaches /sign-in is a studio owner or a customer, and
 * for them a password field is a dead end that looks like the main event —
 * they would try to set one, fail, and conclude the site is broken. The link
 * above stays the obvious path; this opens for the handful of people it is
 * for.
 *
 * ## Why it does not say "ops sign-in"
 *
 * A labelled ops entrance tells a stranger where to aim. The wording is
 * deliberately flat, and the role check happens on the server in
 * modules/auth/password.ts, never here — a hidden field is not a control.
 */
export function PasswordForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(signInWithPasswordAction, INITIAL);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 self-start border-0 bg-transparent p-0 text-[13.5px] text-[var(--color-ink-3)] underline underline-offset-4 hover:text-[var(--color-ink-2)]"
      >
        Sign in with a password instead
      </button>
    );
  }

  return (
    <form action={action} className="mt-1 flex flex-col gap-3 border-t border-[var(--color-rule)] pt-5">
      <div>
        <label htmlFor="pw-email" className="label m-0 mb-2 block">
          Email address
        </label>
        <input
          id="pw-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)]"
        />
      </div>

      <div>
        <label htmlFor="pw-password" className="label m-0 mb-2 block">
          Password
        </label>
        <input
          id="pw-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={state.status === 'error' ? 'pw-error' : undefined}
          aria-invalid={state.status === 'error'}
          className="w-full rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-3 text-[15px] text-[var(--color-ink)]"
        />
      </div>

      {state.status === 'error' ? (
        <p id="pw-error" role="alert" className="m-0 text-[14px] text-[var(--color-atrisk)]">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Checking…' : 'Sign in'}
      </Button>

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="self-start border-0 bg-transparent p-0 text-[13.5px] text-[var(--color-ink-3)] underline underline-offset-4 hover:text-[var(--color-ink-2)]"
      >
        Email me a link instead
      </button>
    </form>
  );
}
