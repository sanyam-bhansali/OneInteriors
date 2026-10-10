'use client';

import { useState, useTransition } from 'react';
import type { IntroState } from '@/modules/studio/introduction';
import { answerIntroductionAction } from '../actions';

/**
 * Take the client, or hand them back.
 *
 * One Interiors introduced them; we ask for an answer so a customer is never
 * left waiting on a studio that is full. Declining needs a reason — ops reads
 * it and places the customer with someone else.
 */
export function IntroAnswer({ state }: { state: IntroState }) {
  const [pending, start] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState(state.answer);

  function send(a: 'accept' | 'decline') {
    setError(null);
    start(async () => {
      const r = await answerIntroductionAction(state.introductionId, a, reason);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setAnswer(a === 'accept' ? 'accepted' : 'declined');
      setDeclining(false);
    });
  }

  if (answer === 'accepted') {
    return (
      <p className="m-0 rounded-[12px] border border-[var(--s-rule)] px-4 py-3 text-[13.5px] text-[var(--s-ink-2)]">
        You accepted this introduction. Call them, then log the call below.
      </p>
    );
  }
  if (answer === 'declined') {
    return (
      <p className="m-0 rounded-[12px] border border-[var(--s-rule)] px-4 py-3 text-[13.5px] text-[var(--s-ink-2)]">
        You declined{state.declineReason ? `: “${state.declineReason}”` : ''}. One Interiors will place them with
        another studio.
      </p>
    );
  }

  return (
    <section className="rounded-[12px] border-[1.5px] border-[var(--s-accent)] px-4 py-3.5">
      <h2 className="m-0 mb-1 text-[15px] font-semibold">New from One Interiors — will you take them?</h2>
      <p className="m-0 mb-3 text-[13.5px] leading-[1.5] text-[var(--s-ink-2)]">
        Accept and call them within a day. If you are full or it is not your kind of job, decline and we place them
        with someone else.
      </p>
      {declining ? (
        <div className="flex flex-col gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="Why — e.g. fully booked until March"
            aria-label="Why you are declining"
            className="rounded-[8px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-2 text-[14px]"
          />
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => send('decline')} className="s-btn">
              {pending ? 'Sending…' : 'Decline'}
            </button>
            <button type="button" onClick={() => setDeclining(false)} className="s-btn-ghost">
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={() => send('accept')} className="s-btn">
            {pending ? 'Saving…' : 'Accept'}
          </button>
          <button type="button" onClick={() => setDeclining(true)} className="s-btn-ghost">
            Decline
          </button>
        </div>
      )}
      {error ? <p className="m-0 mt-2 text-[13px] text-[var(--s-bad,#a6461f)]">{error}</p> : null}
    </section>
  );
}
