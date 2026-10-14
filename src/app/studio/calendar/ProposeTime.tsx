'use client';

import { useState, useTransition } from 'react';
import { proposeAction } from './actions';
import { KIND_LABELS, type AppointmentKindName } from '@/modules/studio/appointment-rules';

/**
 * A studio suggesting a time.
 *
 * `proposeAction` existed with nothing importing it, so the only affordance on
 * this page for "that slot does not work" was copy reading *"tell us and we
 * will propose another"* — with no way to tell us anywhere on the screen. The
 * studio's options were to find our number or to let a confirmed meeting lapse.
 *
 * A proposal, not a booking. Ops confirms on the customer's behalf, because the
 * customer has no scheduling surface of their own yet and the product promises
 * we arrange it. The studio is the party that knows when its site team is free,
 * so it is the right party to suggest — it just is not the party that commits
 * somebody else's Saturday.
 */
export function ProposeTime({ introductionId }: { introductionId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [kind, setKind] = useState<AppointmentKindName>('SITE_VISIT');
  const [when, setWhen] = useState('');
  const [where, setWhere] = useState('');

  if (done) {
    return (
      <p className="ox-ok">
        Sent. We will put it to the customer and confirm — you will see it here either way.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn ghost sm"
        style={{ alignSelf: 'flex-start' }}
      >
        Suggest a different time
      </button>
    );
  }

  return (
    <div className="ox-panel">
      <b style={{ fontSize: 14 }}>Suggest a time</b>

      <div className="hstack" style={{ alignItems: 'flex-end', gap: 10 }}>
        <div className="ox-f">
          <label htmlFor={`kind-${introductionId}`} className="lbl">
            What for
          </label>
          <select
            id={`kind-${introductionId}`}
            value={kind}
            onChange={(e) => setKind(e.target.value as AppointmentKindName)}
            className="fld"
          >
            {(Object.keys(KIND_LABELS) as AppointmentKindName[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="ox-f">
          <label htmlFor={`when-${introductionId}`} className="lbl">
            When
          </label>
          <input
            id={`when-${introductionId}`}
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="fld"
          />
        </div>

        <div className="ox-f">
          <label htmlFor={`where-${introductionId}`} className="lbl">
            Where
          </label>
          <input
            id={`where-${introductionId}`}
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder="The flat"
            className="fld"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="ox-err">
          {error}
        </p>
      ) : null}

      <div className="hstack" style={{ gap: 8 }}>
        <button
          type="button"
          disabled={pending || !when}
          onClick={() =>
            start(async () => {
              setError(null);
              // `datetime-local` has no offset, and `new Date()` on the server
              // would read it as UTC. Convert where the browser's zone is known.
              const result = await proposeAction(
                introductionId,
                kind,
                new Date(when).toISOString(),
                where,
              );
              if (result.ok) setDone(true);
              else setError(result.error);
            })
          }
          className="btn pri sm"
        >
          {pending ? 'Sending…' : 'Send to us'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn ghost sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
