'use client';

import { useActionState } from 'react';
import { choosePasswordAction, type FormState } from '../sign-in/actions';

const INITIAL: FormState = { error: null };

export function PasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(choosePasswordAction, INITIAL);
  return (
    <form action={action} className="oa-body" style={{ paddingTop: 56 }}>
      <input type="hidden" name="next" value={next} />
      <h1 className="oa-title">Choose your own password.</h1>
      <p className="oa-sub">The one your designer gave you works only once. At least 12 characters; a short sentence is easiest to remember.</p>
      <label className="oa-label" htmlFor="oa-new">
        New password
      </label>
      <input id="oa-new" name="password" className="oa-input" type="password" autoComplete="new-password" minLength={12} maxLength={200} required autoFocus />
      <label className="oa-label" htmlFor="oa-again">
        Once more
      </label>
      <input id="oa-again" name="again" className="oa-input" type="password" autoComplete="new-password" minLength={12} maxLength={200} required />
      {state.error ? (
        <p role="alert" className="oa-note oa-error">
          {state.error}
        </p>
      ) : null}
      <div className="oa-foot">
        <button type="submit" className="oa-cta" disabled={pending}>
          {pending ? 'Saving…' : 'Save and open my project'}
        </button>
      </div>
    </form>
  );
}
