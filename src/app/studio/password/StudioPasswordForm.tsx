'use client';

import { useActionState, useState } from 'react';
/* From `password-rules`, not `password`: that file imports node:crypto. */
import { passwordChecks, passwordScore } from '@/modules/auth/password-rules';
import { setPasswordAction, type SecurityState } from '@/app/set-password/actions';

const INITIAL: SecurityState = { status: 'idle' };

/**
 * The studio's own password form (owner, 27 Oct 2026), in the studio's look.
 * Same action and rules as /set-password: the current password only when
 * changing one they chose themselves.
 */
export function StudioPasswordForm({ askCurrent, next }: { askCurrent: boolean; next: string }) {
  const [state, action, pending] = useActionState(setPasswordAction, INITIAL);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [shown, setShown] = useState(false);
  const checks = passwordChecks(password);
  const ready = passwordScore(password) === checks.length && confirm === password;
  const type = shown ? 'text' : 'password';

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input type="hidden" name="next" value={next} />
      {askCurrent ? (
        <label className="ox-f">
          <span className="lbl">Current password</span>
          <input className="fld" aria-label="Current password" name="current" type={type} autoComplete="current-password" required />
        </label>
      ) : null}
      <label className="ox-f">
        <span className="lbl">New password</span>
        <input className="fld" aria-label="New password" name="password" type={type} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {password ? (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {checks.map((c) => (
            <li key={c.id} className={`sm ${c.ok ? 'good-t' : 'muted'}`}>
              {c.ok ? '✓' : '·'} {c.label}
            </li>
          ))}
        </ul>
      ) : (
        <span className="muted sm">12 characters or more. A short phrase you will remember beats something clever you will write down.</span>
      )}
      <label className="ox-f">
        <span className="lbl">Type it again</span>
        <input className="fld" aria-label="Type the new password again" name="confirm" type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </label>
      {confirm && confirm !== password ? <span className="bad-t sm">The two do not match yet.</span> : null}
      <label className="hstack sm" style={{ gap: 6 }}>
        <input type="checkbox" aria-label="Show the passwords" checked={shown} onChange={(e) => setShown(e.target.checked)} />
        Show the passwords
      </label>
      {state.status !== 'idle' && state.message ? (
        <p role={state.status === 'error' ? 'alert' : 'status'} className={state.status === 'error' ? 'ox-err' : 'ox-ok'} style={{ margin: 0 }}>
          {state.message}
        </p>
      ) : null}
      <button type="submit" className="btn pri" disabled={pending || !ready} style={{ alignSelf: 'flex-start' }}>
        {pending ? 'Saving…' : 'Save my password'}
      </button>
    </form>
  );
}
