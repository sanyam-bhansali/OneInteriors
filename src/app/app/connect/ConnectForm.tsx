'use client';

import { useActionState } from 'react';
import { connectAction, type FormState } from '../sign-in/actions';

const INITIAL: FormState = { error: null };

/** "Connect your project" (the owner's v1 screens, 1 Nov 2026): paste the link or type the code the designer sent. */
export function ConnectForm() {
  const [state, action, pending] = useActionState(connectAction, INITIAL);
  return (
    <form action={action} className="oa-body" style={{ paddingTop: 56 }}>
      <span className="oa-meta">Open my project</span>
      <h1 className="oa-title">Connect your project</h1>
      <p className="oa-sub">Your designer sends you a project link. Paste it here, or type its code, and your home opens.</p>
      <label className="oa-label" htmlFor="oa-code">
        Project link or code
      </label>
      <input id="oa-code" name="code" className="oa-input" autoComplete="off" autoCapitalize="characters" maxLength={300} required autoFocus />
      {state.error ? (
        <p role="alert" className="oa-note oa-error">
          {state.error}
        </p>
      ) : (
        <p className="oa-note">No link yet? Ask your designer for it.</p>
      )}
      <div className="oa-foot">
        <button type="submit" className="oa-cta" disabled={pending}>
          {pending ? 'Opening…' : 'Open my project'}
        </button>
      </div>
    </form>
  );
}
