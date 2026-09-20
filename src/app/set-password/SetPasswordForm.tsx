'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui';
import { setPasswordAction, type SecurityState } from './actions';

const INITIAL: SecurityState = { status: 'idle' };

export function SetPasswordForm({
  hasPassword,
  next,
}: {
  hasPassword: boolean;
  next: string;
}) {
  const [state, action, pending] = useActionState(setPasswordAction, INITIAL);

  const field =
    'w-full rounded-[8px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-3 text-[15px] text-[var(--color-ink)]';

  return (
    <form action={action} className="flex max-w-[460px] flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {hasPassword ? (
        <div>
          <label htmlFor="current" className="label m-0 mb-2 block">
            Current password
          </label>
          <input id="current" name="current" type="password" autoComplete="current-password" required className={field} />
        </div>
      ) : null}

      <div>
        <label htmlFor="password" className="label m-0 mb-2 block">
          {hasPassword ? 'New password' : 'Password'}
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} className={field} />
        <p className="m-0 mt-2 text-[13px] leading-relaxed text-[var(--color-ink-3)]">
          At least 12 characters. Length matters more than symbols — a short phrase you
          will remember beats something clever you will write down.
        </p>
      </div>

      <div>
        <label htmlFor="confirm" className="label m-0 mb-2 block">
          Type it again
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={field} />
      </div>

      {state.status !== 'idle' ? (
        <p
          role="alert"
          className={`m-0 text-[14px] ${
            state.status === 'ok' ? 'text-[var(--color-ontrack-ink)]' : 'text-[var(--color-atrisk)]'
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
      </Button>
    </form>
  );
}
