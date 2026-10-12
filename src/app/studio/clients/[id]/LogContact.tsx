'use client';

import { useState, useTransition } from 'react';
import {
  CALL_OUTCOMES,
  OUTCOME_FOLLOWUP,
  ago,
  type CallOutcomeId,
} from '@/modules/studio-practice/event-copy';
import { logContactAction, markLostAction } from '../actions';
import { CallWhen, callWhen, type CallWhenValue } from '../../CallWhen';

/**
 * "I have just spoken to them."
 *
 * ## Why the outcome is a row of buttons and not a dropdown
 *
 * This is pressed straight after hanging up, often on a phone, by somebody
 * about to make the next call. A select is two taps and a scroll; seven
 * buttons is one tap. The cost of the extra width is the cost of the feature
 * being used at all — an outcome nobody records is a timeline full of
 * "contacted them" that says nothing.
 *
 * ## Why "No answer" is first
 *
 * It is the most common outcome of ringing a stranger. A list ordered by how
 * well the call went buries the realistic option under four optimistic ones,
 * and gets misclicked.
 *
 * ## The note is optional and stays optional
 *
 * Requiring it would mean every call costs a sentence, so calls stop being
 * logged. One tap has to be enough, and the note is there for the call that
 * actually produced something worth remembering.
 */
export function LogContact({
  clientId,
  lastContactedAt,
}: {
  clientId: string;
  lastContactedAt: Date | null;
}) {
  /* Open from the start, as the design's call card is; it folds after a call is logged. */
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /* AxLeads (12 Oct 2026): the person may choose when to call next instead
     of the outcome's own time; and after "Wrong number", mark it lost. */
  const [when, setWhen] = useState<CallWhenValue | null>(null);
  const [askLost, setAskLost] = useState(false);

  function log(outcome: CallOutcomeId) {
    setError(null);
    start(async () => {
      const result = await logContactAction(clientId, outcome, note.trim() || null, when ? { day: when.day, time: when.time } : null);
      if ('error' in result) {
        setError(result.error);
      } else {
        setNote('');
        setWhen(null);
        if (outcome === 'wrong_number') setAskLost(true);
        else setOpen(false);
      }
    });
  }

  function markLost() {
    setError(null);
    start(async () => {
      const result = await markLostAction(clientId, 'WRONG_NUMBER');
      if ('error' in result) setError(result.error);
      else {
        setAskLost(false);
        setOpen(false);
      }
    });
  }

  if (askLost) {
    return (
      <div className="card">
        <p style={{ margin: 0, fontWeight: 600 }}>Logged: wrong number. Mark this lead lost — wrong number?</p>
        <p className="cl-sub">Only if there is no other way to reach them. You can move it back any time.</p>
        <div className="hstack" style={{ gap: 8 }}>
          <button type="button" disabled={pending} onClick={markLost} className="btn pri sm">
            {pending ? 'Marking…' : 'Mark lost — wrong number'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAskLost(false);
              setOpen(false);
            }}
            className="btn sec sm"
          >
            Keep it open
          </button>
        </div>
        {error ? (
          <p role="alert" className="cl-err">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="card" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn pri sm"
        >
          Log a call
        </button>
        <span className="muted sm">
          {lastContactedAt ? `Last spoke ${ago(lastContactedAt)}` : 'Nobody has logged a call yet'}
        </span>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="chead">
        <h2>What happened on the call?</h2>
        <span className="hstack" style={{ gap: 8 }}>
          <span className="acc-t sm">One tap logs it with the time</span>
          <button type="button" onClick={() => setOpen(false)} className="btn ghost xs">
            Hide
          </button>
        </span>
      </div>

      {/* The note sits ABOVE the buttons on purpose: the buttons commit, so
          anything typed after pressing one would be lost. Ordering the
          controls in the order they are used is the whole trick. */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Anything worth remembering (optional)"
        className="fld"
        style={{ minHeight: 64 }}
      />

      <div className="quick">
        {CALL_OUTCOMES.map((o) => {
          const f = OUTCOME_FOLLOWUP[o.id];
          return (
            <button
              key={o.id}
              type="button"
              disabled={pending}
              onClick={() => log(o.id)}
              /* The consequence, before the click. Each of these sets the
                 lead's next action, and a button that silently rewrites
                 somebody's follow-up is a button they stop trusting. */
              title={
                f === 'clear'
                  ? 'Clears the follow-up'
                  : f
                    ? `Sets: ${f.action}`
                    : 'Leaves the follow-up as it is'
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* Said once, in words, rather than only in a tooltip nobody hovers on
          a phone. */}
      <p className="cl-sub" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
        Whichever you pick sets what to do next and when — Busy tries again in two hours, Switched off
        tomorrow afternoon, Voicemail at 4 pm — except &ldquo;Not interested&rdquo; and &ldquo;Wrong
        number&rdquo;, which clear the follow-up rather than inventing one.
      </p>

      <div>
        {when ? (
          <>
            <CallWhen value={when} onChange={setWhen} label="Call next (instead of the outcome's time)" />
            <button type="button" onClick={() => setWhen(null)} className="btn ghost xs" style={{ marginTop: 6 }}>
              Use the outcome&rsquo;s time
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setWhen(callWhen('tomorrow'))} className="btn ghost xs">
            Choose when to call next
          </button>
        )}
      </div>

      {error ? (
        <p role="alert" className="cl-err">
          {error}
        </p>
      ) : null}
    </div>
  );
}
