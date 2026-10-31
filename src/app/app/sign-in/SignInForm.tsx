'use client';

import { useActionState } from 'react';
import { signInAction, type FormState } from './actions';

const INITIAL: FormState = { error: null };

/** "Good to see you again" (the owner's v1 screens), with the studio's password in place of the WhatsApp code. */
export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInAction, INITIAL);
  return (
    <form action={action} className="oa-body" style={{ paddingTop: 56 }}>
      <input type="hidden" name="next" value={next} />
      <h1 className="oa-title">Good to see you again.</h1>
      <p className="oa-sub">Your mobile number, and the password your designer gave you.</p>
      <label className="oa-label" htmlFor="oa-phone">
        Mobile number
      </label>
      <input id="oa-phone" name="phone" className="oa-input" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98220 41736" maxLength={16} required autoFocus />
      <label className="oa-label" htmlFor="oa-password">
        Password
      </label>
      <input id="oa-password" name="password" className="oa-input" type="password" autoComplete="current-password" maxLength={200} required />
      {state.error ? (
        <p role="alert" className="oa-note oa-error">
          {state.error}
        </p>
      ) : null}
      <div className="oa-foot">
        <button type="submit" className="oa-cta" disabled={pending}>
          {pending ? 'Checking…' : 'Sign in'}
        </button>
        <p className="oa-foot-note">Forgot it, or locked out? Ask your designer for a new one-time password.</p>
      </div>
    </form>
  );
}
