'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CALL_REACTIONS, attemptLine, type CallReactionId } from '@/modules/studio-practice/call-log';
import { colourOf } from '@/modules/studio-practice/vocabulary';
import { logPickedUpAction } from '../actions';
import { Modal } from '../ax-ui';
import { CallWhen, callWhen, type CallWhenValue } from '../../CallWhen';

/**
 * "Picked up · log the call" (AxLeads, owner 13 Oct 2026): what they said in
 * one tap each, an optional stage move, a note (required), how long it
 * lasted, and an optional follow-up. Opened from Log call → Picked up.
 */
export function PickedUpSheet({
  lead,
  stages,
  previousCalls,
  onClose,
  onLogged,
}: {
  lead: { id: string; name: string; phone: string | null; stageId: string | null };
  stages: { id: string; name: string; colour: string; kind: string }[];
  previousCalls: number;
  onClose: () => void;
  onLogged?: () => void;
}) {
  const router = useRouter();
  const [reactions, setReactions] = useState<CallReactionId[]>([]);
  const [stageId, setStageId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [minutes, setMinutes] = useState('');
  const [follow, setFollow] = useState<CallWhenValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const close = useCallback(() => {
    if (!pending) onClose();
  }, [onClose, pending]);

  const toggle = (id: CallReactionId) => setReactions((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  const log = () => {
    setError(null);
    if (!note.trim()) {
      setError('Write a line about the call before logging it.');
      return;
    }
    start(async () => {
      const r = await logPickedUpAction(lead.id, {
        reactions,
        note,
        minutes,
        stageId: stageId && stageId !== lead.stageId ? stageId : null,
        when: follow ? { day: follow.day, time: follow.time } : null,
      });
      if ('error' in r && r.error) {
        setError(r.error);
        return;
      }
      onLogged?.();
      onClose();
      router.refresh();
    });
  };

  return (
    <Modal onClose={close} labelledBy="pu-title" width="min(600px, 96vw)">
      <div className="pu">
        <div className="pu-top">
          <span className="good-t pu-eyebrow">✓ Picked up · log the call</span>
          <button type="button" className="btn ghost sm" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
        <h2 id="pu-title" className="pu-name">
          {lead.name}
        </h2>
        <div className="pu-who">
          <b>{lead.name}</b>
          {lead.phone ? <span className="mono muted"> · {lead.phone}</span> : null}
        </div>

        <section className="pu-sec">
          <div className="pu-h">
            <b>Reactions</b>
            <span className="muted sm">tap what happened, no typing</span>
          </div>
          <div className="pu-chips">
            {CALL_REACTIONS.map((r) => (
              <button key={r.id} type="button" className="pu-chip" aria-pressed={reactions.includes(r.id)} onClick={() => toggle(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        </section>

        <section className="pu-sec">
          <div className="pu-h">
            <b>Move to stage</b>
            <span className="muted sm">optional</span>
          </div>
          <div className="pu-chips">
            {stages.map((s) => {
              const now = s.id === lead.stageId;
              const on = stageId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className="pu-chip"
                  aria-pressed={on}
                  disabled={now}
                  onClick={() => setStageId(on ? null : s.id)}
                  title={now ? 'Where they are now' : undefined}
                >
                  <span className="pu-dot" style={{ background: colourOf(s.colour).dot }} />
                  {s.name}
                  {now ? <span className="muted"> · now</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="pu-sec">
          <label htmlFor="pu-note" className="pu-h">
            <b>
              Notes <span className="bad-t">*</span>
            </b>
          </label>
          <textarea
            id="pu-note"
            className="fld"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='e.g. "Comparing two studios. Wants kitchen photos by tonight."'
            style={{ minHeight: 88, padding: 12 }}
          />
        </section>

        <section className="pu-sec">
          <label htmlFor="pu-min" className="pu-h">
            <b>Duration (minutes)</b>
          </label>
          <input id="pu-min" className="fld" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="optional" />
        </section>

        <section className="pu-sec">
          <label className="pu-check">
            <input type="checkbox" checked={follow !== null} onChange={(e) => setFollow(e.target.checked ? callWhen('tomorrow') : null)} />
            Schedule a follow-up call (they asked you to call back)
          </label>
          {follow ? <CallWhen value={follow} onChange={setFollow} label="Call them" /> : null}
        </section>

        {error ? (
          <p role="alert" className="bad-t sm" style={{ margin: 0 }}>
            {error}
          </p>
        ) : null}

        <div className="pu-foot">
          <span className="muted sm">{attemptLine(previousCalls)}</span>
          <span className="hstack">
            <button type="button" className="btn ghost sm" onClick={close} disabled={pending}>
              Cancel
            </button>
            <button type="button" className="btn pri" onClick={log} disabled={pending}>
              {pending ? 'Logging…' : '✓ Log call'}
            </button>
          </span>
        </div>
      </div>
    </Modal>
  );
}
