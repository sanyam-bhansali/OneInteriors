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
      <p className="card" style={{ margin: 0, color: 'var(--text2)' }}>
        You accepted this introduction. Call them, then log the call below.
      </p>
    );
  }
  if (answer === 'declined') {
    return (
      <p className="card" style={{ margin: 0, color: 'var(--text2)' }}>
        You declined{state.declineReason ? `: “${state.declineReason}”` : ''}. One Interiors will place them with
        another studio.
      </p>
    );
  }

  return (
    <section className="card cl-next">
      <h2 className="h">New from One Interiors — will you take them?</h2>
      <p style={{ margin: 0, lineHeight: 1.5, color: 'var(--text2)' }}>
        Accept and call them within a day. If you are full or it is not your kind of job, decline and we place them
        with someone else.
      </p>
      {declining ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="Why — e.g. fully booked until March"
            aria-label="Why you are declining"
            className="fld"
          />
          <div className="hstack" style={{ gap: 8 }}>
            <button type="button" disabled={pending} onClick={() => send('decline')} className="btn pri sm">
              {pending ? 'Sending…' : 'Decline'}
            </button>
            <button type="button" onClick={() => setDeclining(false)} className="btn sec sm">
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="hstack" style={{ gap: 8 }}>
          <button type="button" disabled={pending} onClick={() => send('accept')} className="btn pri sm">
            {pending ? 'Saving…' : 'Accept'}
          </button>
          <button type="button" onClick={() => setDeclining(true)} className="btn sec sm">
            Decline
          </button>
        </div>
      )}
      {error ? <p className="cl-err">{error}</p> : null}
    </section>
  );
}
