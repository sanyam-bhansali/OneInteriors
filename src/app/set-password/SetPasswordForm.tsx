'use client';

import { useActionState, useEffect, useState } from 'react';
/* From `password-rules`, NOT `password`. That file imports node:crypto
   for scrypt, and webpack follows the whole module into the client
   bundle — the build fails with UnhandledSchemeError. */
import { passwordChecks, passwordScore, MIN_PASSWORD } from '@/modules/auth/password-rules';
import { setPasswordAction, type SecurityState } from './actions';

const INITIAL: SecurityState = { status: 'idle' };

/**
 * Setting a password, as a single card.
 *
 * ## The checklist is the server's rules, not a mockup's
 *
 * It renders `passwordChecks` from `modules/auth/password` — the same
 * predicates `passwordProblem` decides on. A meter that disagrees with
 * the server is worse than no meter: it either blocks somebody for a
 * rule nobody enforces, or says "strong" and then the submit fails.
 *
 * So there is no "include a number" and no "include a special
 * character" here, because we do not require either. Composition rules
 * push people toward `Password1!` and a sticky note; length is what
 * costs a guesser time, and twelve characters behind a five-attempt
 * lock is not the weak link.
 *
 * ## Everything validates as you type, except the things that cannot
 *
 * The four rules and the match indicator are live. What is NOT live is
 * the current password — checking that as you type would be an oracle
 * anybody could hold down a key against, so it is only ever decided by
 * the server, once, on submit.
 */
export function SetPasswordForm({ hasPassword, next }: { hasPassword: boolean; next: string }) {
  const [state, action, pending] = useActionState(setPasswordAction, INITIAL);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [shake, setShake] = useState(false);

  const checks = passwordChecks(password);
  const score = passwordScore(password);
  const typed = password.length > 0;
  const matches = confirm.length > 0 && confirm === password;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = score === 4 && matches;

  /* Shake once when the server rejects. The class is removed again so a
     second failure shakes too — an animation that only ever plays once
     reads as the page freezing. */
  useEffect(() => {
    if (state.status === 'error') {
      setShake(true);
      const t = setTimeout(() => setShake(false), 420);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form action={action} className={`flex flex-col gap-5 ${shake ? 'oi-shake' : ''}`}>
      <input type="hidden" name="next" value={next} />

      {hasPassword ? (
        <PasswordField
          id="current"
          name="current"
          label="Current password"
          autoComplete="current-password"
        />
      ) : null}

      <div>
        <PasswordField
          id="password"
          name="password"
          label={hasPassword ? 'New password' : 'Choose a password'}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />

        {/* The bar appears only once there is something to measure. An
            empty four-segment meter at rest is decoration. */}
        <div
          className="mt-3 grid grid-cols-4 gap-1.5"
          aria-hidden="true"
          style={{ opacity: typed ? 1 : 0.35 }}
        >
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-colors duration-300 motion-reduce:transition-none ${
                i < score ? barColour(score) : 'bg-[var(--color-rule)]'
              }`}
            />
          ))}
        </div>

        {typed ? (
          <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
            {/* The tick is decorative, so each row repeats its state as
                text. A checklist that says "met" only in colour and shape
                is read by a screen reader as four requirements with no
                indication of which are satisfied. */}
            {checks.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-[13.5px]">
                <Tick on={c.ok} />
                <span className={c.ok ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-2)]'}>
                  {c.label}
                  <span className="sr-only">{c.ok ? ' — met' : ' — not yet'}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
            {MIN_PASSWORD} characters or more. A short phrase you will remember beats something
            clever you will write down.
          </p>
        )}
      </div>

      <div>
        <PasswordField
          id="confirm"
          name="confirm"
          label="Type it again"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          invalid={mismatch}
        />
        {confirm.length > 0 ? (
          <p
            className={`m-0 mt-2 flex items-center gap-2 text-[13.5px] ${
              matches ? 'text-[var(--color-ontrack)]' : 'text-[var(--color-ink-2)]'
            }`}
          >
            <Tick on={matches} />
            {matches ? 'Both match' : 'Not the same yet'}
          </p>
        ) : null}
      </div>

      {state.status !== 'idle' ? (
        <p
          role="alert"
          className={`m-0 rounded-[10px] px-4 py-3 text-[14px] leading-relaxed ${
            state.status === 'ok'
              ? 'bg-[var(--color-ontrack-soft)] text-[var(--color-ontrack)]'
              : 'bg-[var(--color-atrisk-soft)] text-[var(--color-atrisk)]'
          }`}
        >
          {state.message}
        </p>
      ) : null}

      {/* Disabled until it would actually succeed. A button you can press
          into a rejection you could already see coming is worse than one
          that waits. `aria-disabled` as well, so a screen reader is told
          why rather than meeting an inert control. */}
      <button
        type="submit"
        disabled={pending || !ready}
        aria-disabled={pending || !ready}
        className="oi-cta mt-1 flex w-full items-center justify-center gap-2 px-6 py-4 text-[16px] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
      >
        {pending ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : (
          <>
            {hasPassword ? 'Change password' : 'Set password'}
            <span aria-hidden="true">→</span>
          </>
        )}
      </button>
    </form>
  );
}

function barColour(score: number): string {
  if (score >= 4) return 'bg-[var(--color-ontrack)]';
  if (score >= 2) return 'bg-[var(--color-brass)]';
  return 'bg-[var(--color-atrisk)]';
}

/**
 * A password box with a show/hide toggle.
 *
 * The toggle is a real `<button>` inside the field, not an icon with a
 * click handler: it has to be reachable by keyboard, and it has to say
 * which state it is in — "Show password" / "Hide password" — because an
 * eye glyph alone tells a screen reader nothing.
 *
 * `type` flips rather than the value being mirrored anywhere, so the
 * plain text never exists in React state or in a second DOM node.
 */
function PasswordField({
  id,
  name,
  label,
  autoComplete,
  value,
  onChange,
  invalid = false,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  value?: string;
  onChange?: (v: string) => void;
  invalid?: boolean;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[14px] font-bold text-[var(--color-ink)]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          aria-invalid={invalid || undefined}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={`oi-input w-full rounded-[12px] border px-4 py-3.5 pr-12 text-[15.5px] text-[var(--color-ink)] ${
            invalid ? 'border-[var(--color-atrisk)]' : 'border-[var(--color-rule)]'
          }`}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-[12px] text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
        >
          <span className="sr-only">{shown ? 'Hide password' : 'Show password'}</span>
          <Eye off={shown} />
        </button>
      </div>
    </div>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors duration-200 motion-reduce:transition-none ${
        on ? 'bg-[var(--color-ontrack)] text-white' : 'border border-[var(--color-rule)]'
      }`}
    >
      {on ? (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
          <path
            d="M2.5 6.2 L4.8 8.5 L9.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

function Eye({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-[18px] w-[18px]">
      <path
        d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {off ? (
        <path d="M3.5 3.5 L16.5 16.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 animate-spin">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <path d="M8 1.5 A6.5 6.5 0 0 1 14.5 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
