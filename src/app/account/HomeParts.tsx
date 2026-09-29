'use client';

import { useActionState, useState, useTransition } from 'react';
import { checkInAction, type CheckInState } from './actions';
import { createShareLinkAction, revokeShareLinkAction } from '@/app/compare/actions';
import { MATCHED, MATCHED_LABELS } from '@/modules/studio/check-in';

const INITIAL: CheckInState = { status: 'idle' };
const chip =
  'cursor-pointer rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2 text-[14px] text-[var(--color-ink-2)] has-[:checked]:border-[var(--color-petrol)] has-[:checked]:bg-[var(--color-petrol-soft)] has-[:checked]:text-[var(--color-ink)]';

/** Two questions after the first meeting — they tell us whether we matched you well. */
export function CheckInForm({ introductionId, studioName }: { introductionId: string; studioName: string }) {
  const [state, action, pending] = useActionState(checkInAction, INITIAL);
  const err = state.errors ?? {};
  if (state.status === 'saved') {
    return <p className="m-0 mt-3 text-[14px] text-[var(--color-ontrack)]">Thank you — that goes straight into how we match.</p>;
  }
  return (
    <form action={action} className="mt-4 flex flex-col gap-4 rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-4">
      <input type="hidden" name="introductionId" value={introductionId} />
      <fieldset className="m-0 border-0 p-0">
        <legend className="m-0 mb-2 p-0 text-[14.5px] text-[var(--color-ink)]">
          Did {studioName} match what we told you about them?
        </legend>
        <div className="flex flex-wrap gap-2">
          {MATCHED.map((m) => (
            <label key={m} className={chip}>
              <input type="radio" name="matched" value={m} className="sr-only" />
              {MATCHED_LABELS[m]}
            </label>
          ))}
        </div>
        {err.matched ? <p className="m-0 mt-1 text-[13px] text-[var(--color-atrisk)]">{err.matched}</p> : null}
      </fieldset>
      <fieldset className="m-0 border-0 p-0">
        <legend className="m-0 mb-2 p-0 text-[14.5px] text-[var(--color-ink)]">How was the communication?</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={chip}>
              <input type="radio" name="communication" value={n} className="sr-only" />
              {n}
              {n === 1 ? ' — poor' : n === 5 ? ' — excellent' : ''}
            </label>
          ))}
        </div>
        {err.communication ? <p className="m-0 mt-1 text-[13px] text-[var(--color-atrisk)]">{err.communication}</p> : null}
      </fieldset>
      <textarea
        name="note"
        rows={2}
        placeholder="Anything we should know? (optional)"
        className="w-full rounded-[10px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2 text-[14px]"
      />
      {err.form ? <p className="m-0 text-[13px] text-[var(--color-atrisk)]">{err.form}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-[var(--color-petrol)] px-5 py-2.5 text-[14px] text-[var(--color-paper)] disabled:opacity-40"
      >
        {pending ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}

/** A read-only link to the brief, quotes and comparison — for whoever else is deciding. */
export function ShareButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [off, setOff] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      {url ? (
        <div className="flex flex-wrap items-center gap-3">
          <code className="max-w-full truncate rounded-[8px] bg-[var(--color-paper-2)] px-3 py-2 text-[13px]">{url}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(url).then(() => setCopied(true));
            }}
            className="rounded-full border border-[var(--color-rule)] px-4 py-1.5 text-[13.5px]"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await createShareLinkAction().catch(() => null);
              if (r?.ok) setUrl(r.url);
              else setError(r && !r.ok ? r.error : 'Could not make a link just now.');
            })
          }
          className="self-start rounded-full border border-[var(--color-rule)] px-5 py-2.5 text-[14px] text-[var(--color-ink)] hover:border-[var(--color-ink-3)] disabled:opacity-40"
        >
          {pending ? 'Making a link…' : 'Share with family'}
        </button>
      )}
      {error ? <p className="m-0 text-[13px] text-[var(--color-atrisk)]">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await revokeShareLinkAction().catch(() => ({ ok: false }));
            setUrl(null);
            setCopied(false);
            setError(r.ok ? null : 'Could not switch it off just now.');
            setOff(r.ok);
          })
        }
        className="self-start border-0 bg-transparent p-0 text-[13px] text-[var(--color-ink-3)] underline hover:text-[var(--color-ink)]"
      >
        {off ? 'Link switched off — nobody can open it now' : 'Switch off any link I have shared'}
      </button>
    </div>
  );
}
