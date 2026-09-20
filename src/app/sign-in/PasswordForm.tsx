'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui';
import { signInWithPasswordAction, type PasswordState } from './actions';

const INITIAL: PasswordState = { status: 'idle' };

/**
 * Email and password. Studios and ops.
 *
 * ## Why this is open by default and the link is the fallback
 *
 * It was the other way round when only ops had passwords, and that was right
 * then. It is wrong now: a studio owner signs in to work, repeatedly, often
 * from a site visit on a phone, and they set a password on their very first
 * visit. Making them find a disclosure to reach the normal way in would put
 * the daily path behind the exceptional one.
 *
 * The emailed link stays directly underneath, unhidden, because it is what
 * somebody who has forgotten their password needs and they should not have to
 * hunt for it while frustrated.
 *
 * ## Why nothing here says "staff" or "ops"
 *
 * A labelled entrance tells a stranger where to aim. The wording is flat, and
 * the role check happens on the server in modules/auth/password.ts — a form
 * that only renders for some people is not a control, because the action is
 * directly invocable.
 */
export function PasswordForm() {
  const [state, action, pending] = useActionState(signInWithPasswordAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-3">
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
    </form>
  );
}
