'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CALL_MENU } from '@/modules/studio-practice/call-log';
import { followupDue, type CallOutcomeId } from '@/modules/studio-practice/event-copy';
import { giveUpStage, isNotPickedUp, suggestCallMove, type CallStage } from '@/modules/studio-practice/call-step-rules';
import { RETRY_LABELS, istInputs, retryChoices, whenLabel, type RetryChoice } from '@/modules/studio-sales/call-schedule';
import { telLink, whatsappLink } from '@/modules/studio-sales/lead-rules';
import { LineIcon } from '../ui/icons';
import { Modal, btnOutline, btnPrimary } from './ax-ui';
import { logContactAction, markLostAction } from './actions';
import { PickedUpSheet } from './[id]/PickedUpSheet';
import { CallWhen, callWhen, type CallWhenValue } from '../CallWhen';

/** A column as the call sheet needs it: the board's own fields, plus the two flags the rule reads. */
export interface CallSheetStage extends CallStage {
  colour: string;
}

export interface CallSheetLead {
  id: string;
  name: string;
  phone: string | null;
  stageId: string;
}

/** What happened, for a list that wants to update its row without a reload. */
export interface CallLogged {
  outcome: CallOutcomeId;
  /** The column the lead went to with the call, if it moved. */
  movedTo: { id: string; name: string; colour: string; kind: string } | null;
  at: Date;
}

/**
 * Log call, the same everywhere (calling steps, owner 21 Oct 2026): the
 * lead page, a row of the list, a card on the board and a line of Today all
 * open this sheet. What happened → then, for a call nobody picked up, when
 * to try again and the suggested move; for Picked up, the Picked up sheet;
 * for Wrong number, whether to mark them lost.
 *
 * "Easy, not automatic": the suggested move ("Move to Calling 2") is shown
 * ticked and can be unticked; after the last calling step nothing is ticked
 * and Junk / Lost — no response are one tap each. The retry starts on the
 * outcome's usual time, so the whole thing is still one tap on "Log call".
 * The server checks the move against the same rule before it does it.
 */
export function CallSheet({
  lead,
  stages,
  outcome: preset,
  previousCalls,
  onClose,
  onLogged,
}: {
  lead: CallSheetLead;
  stages: CallSheetStage[];
  /** Skip the first step (the lead page picks the outcome from its own menu). */
  outcome?: CallOutcomeId | 'picked_up' | null;
  previousCalls?: number;
  onClose: () => void;
  onLogged?: (r: CallLogged) => void;
}) {
  const [outcome, setOutcome] = useState<CallOutcomeId | 'picked_up' | null>(preset ?? null);

  if (outcome === 'picked_up') {
    return (
      <PickedUpSheet
        lead={{ id: lead.id, name: lead.name, phone: lead.phone, stageId: lead.stageId }}
        stages={stages.map((s) => ({ id: s.id, name: s.name, colour: s.colour, kind: s.kind }))}
        previousCalls={previousCalls}
        onClose={onClose}
        onLogged={() => onLogged?.({ outcome: 'spoke', movedTo: null, at: new Date() })}
      />
    );
  }

  return (
    <Modal onClose={onClose} labelledBy="call-title" width="min(520px, 96vw)">
      <div className="pu">
        <div className="pu-top">
          <span className="pu-eyebrow muted">{outcome ? `${CALL_MENU.find((o) => o.id === outcome)?.label ?? 'Call'} · log the call` : 'Log call'}</span>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <h2 id="call-title" className="pu-name">
          {lead.name}
        </h2>
        {lead.phone ? <span className="mono muted sm">{lead.phone}</span> : null}
        {outcome === null ? (
          <OutcomeStep onPick={setOutcome} />
        ) : outcome === 'wrong_number' ? (
          <WrongNumberStep lead={lead} onClose={onClose} onLogged={onLogged} />
        ) : (
          <MissedStep lead={lead} stages={stages} outcome={outcome} onBack={preset ? null : () => setOutcome(null)} onClose={onClose} onLogged={onLogged} />
        )}
      </div>
    </Modal>
  );
}

/** Step one: what happened, one tap each, in AxLeads' order. */
function OutcomeStep({ onPick }: { onPick: (o: CallOutcomeId | 'picked_up') => void }) {
  return (
    <section className="pu-sec" aria-label="Call outcome">
      <div className="pu-h">
        <b>What happened?</b>
      </div>
      <div className="pu-chips">
        {CALL_MENU.map((o, i) => (
          <button key={o.id} type="button" className="pu-chip" autoFocus={i === 0} onClick={() => onPick(o.id as CallOutcomeId | 'picked_up')}>
            <span className={o.id === 'picked_up' ? 'good-t' : o.id === 'wrong_number' ? 'bad-t' : 'warn-t'} aria-hidden>
              {o.id === 'picked_up' ? '✓' : o.id === 'wrong_number' ? '⚠' : o.id === 'voicemail' ? '◌' : '☎'}
            </span>
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * A call nobody picked up: when to try again (the outcome's usual time
 * first, so one tap still works), "Don't retry" (lost — stopped replying),
 * and the suggested move.
 */
function MissedStep({
  lead,
  stages,
  outcome,
  onBack,
  onClose,
  onLogged,
}: {
  lead: CallSheetLead;
  stages: CallSheetStage[];
  outcome: CallOutcomeId;
  onBack: (() => void) | null;
  onClose: () => void;
  onLogged?: (r: CallLogged) => void;
}) {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const missed = isNotPickedUp(outcome);
  const auto = useMemo(() => followupDue(outcome, now), [outcome, now]);
  const retry = useMemo(() => retryChoices(auto, now), [auto, now]);
  const suggestion = useMemo(() => suggestCallMove(stages, lead.stageId, outcome), [stages, lead.stageId, outcome]);
  const giveUp = useMemo(() => giveUpStage(stages, lead.stageId, outcome), [stages, lead.stageId, outcome]);

  const [choice, setChoice] = useState<RetryChoice>(retry.preset);
  const [pick, setPick] = useState<CallWhenValue>(() => callWhen('pick', now));
  const [moveOn, setMoveOn] = useState(true);
  const [close, setClose] = useState<'keep' | 'junk' | 'lost'>('keep');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const closing = suggestion.kind === 'close' && close !== 'keep';
  const target: { id: string; name: string } | null =
    choice === 'none' && giveUp
      ? giveUp
      : suggestion.kind === 'close' && close === 'junk'
        ? suggestion.junk
        : suggestion.kind === 'close' && close === 'lost'
          ? suggestion.lost
          : suggestion.kind === 'move' && moveOn
            ? suggestion.to
            : null;
  const choices = retry.choices.filter((c) => c.id !== 'none' || giveUp !== null);

  const log = () => {
    setError(null);
    let when: { day: string; time: string } | null = null;
    if (choice !== 'none' && !closing) {
      if (choice === 'pick') {
        if (!pick.day || !pick.time) return setError('Pick a day and a time, or choose another option.');
        when = { day: pick.day, time: pick.time };
      } else if (choice !== 'auto') {
        const at = retry.choices.find((c) => c.id === choice)?.at;
        when = at ? istInputs(at) : null;
      }
    }
    start(async () => {
      try {
        const r = await logContactAction(lead.id, outcome, null, when, target?.id ?? null);
        if (r && 'error' in r && typeof r.error === 'string') {
          setError(r.error);
          return;
        }
        const to = target ? stages.find((s) => s.id === target.id) : undefined;
        onLogged?.({ outcome, movedTo: to ? { id: to.id, name: to.name, colour: to.colour, kind: to.kind } : null, at: new Date() });
        onClose();
        router.refresh();
      } catch {
        setError('That did not go through. Try again.');
      }
    });
  };

  return (
    <>
      {missed && !closing ? (
        <section className="pu-sec">
          <div className="pu-h" id="retry-h">
            <b>Try again</b>
          </div>
          <div role="radiogroup" aria-labelledby="retry-h" className="pu-chips">
            {choices.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={choice === c.id} className="pu-chip" onClick={() => setChoice(c.id)}>
                {RETRY_LABELS[c.id]}
                {c.at ? <span className="muted"> · {whenLabel(c.at, now)}</span> : null}
              </button>
            ))}
          </div>
          {choice === 'pick' ? <CallWhen value={pick} onChange={(v) => setPick({ ...v, mode: 'pick' })} label="Call them" /> : null}
          {choice === 'none' && giveUp ? <p className="muted sm" style={{ margin: 0 }}>Marks {lead.name} lost — stopped replying, in {giveUp.name}. You can move them back any time.</p> : null}
        </section>
      ) : null}

      {choice !== 'none' && suggestion.kind === 'move' ? (
        <section className="pu-sec">
          <label className="pu-check">
            <input type="checkbox" checked={moveOn} onChange={(e) => setMoveOn(e.target.checked)} />
            Move to {suggestion.to.name}
          </label>
        </section>
      ) : null}

      {choice !== 'none' && suggestion.kind === 'close' ? (
        <section className="pu-sec">
          <div className="pu-h" id="close-h">
            <b>That was the last calling step</b>
          </div>
          <div role="radiogroup" aria-labelledby="close-h" className="pu-chips">
            <button type="button" role="radio" aria-checked={close === 'keep'} className="pu-chip" onClick={() => setClose('keep')}>
              Keep in {suggestion.keep.name}
            </button>
            {suggestion.junk ? (
              <button type="button" role="radio" aria-checked={close === 'junk'} className="pu-chip" onClick={() => setClose('junk')}>
                {suggestion.junk.name}
              </button>
            ) : null}
            {suggestion.lost ? (
              <button type="button" role="radio" aria-checked={close === 'lost'} className="pu-chip" onClick={() => setClose('lost')}>
                {suggestion.lost.name} — no response
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="bad-t sm" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}

      <div className="pu-foot">
        {onBack ? (
          <button type="button" className="btn ghost sm" onClick={onBack} disabled={pending}>
            ← Back
          </button>
        ) : (
          <span />
        )}
        <span className="hstack">
          <button type="button" className="btn ghost sm" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn pri" onClick={log} disabled={pending} autoFocus>
            {pending ? 'Logging…' : target ? `✓ Log call · ${target.name}` : '✓ Log call'}
          </button>
        </span>
      </div>
    </>
  );
}

/** Wrong number: log it, and only if the person says so, mark them lost. */
function WrongNumberStep({ lead, onClose, onLogged }: { lead: CallSheetLead; onClose: () => void; onLogged?: (r: CallLogged) => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = (lost: boolean) =>
    start(async () => {
      setError(null);
      try {
        const r = await logContactAction(lead.id, 'wrong_number', null, null);
        if (r && 'error' in r && typeof r.error === 'string') return setError(r.error);
        if (lost) {
          const m = await markLostAction(lead.id, 'WRONG_NUMBER');
          if (m && 'error' in m && typeof m.error === 'string') {
            router.refresh();
            return setError(`The call is logged, but they were not marked lost: ${m.error}`);
          }
        }
        onLogged?.({ outcome: 'wrong_number', movedTo: null, at: new Date() });
        onClose();
        router.refresh();
      } catch {
        setError('That did not go through. Try again.');
      }
    });
  return (
    <>
      <p className="cl-sub" style={{ margin: 0 }}>
        Mark {lead.name} lost too? Only if there is no other way to reach them. You can move it back any time.
      </p>
      {error ? (
        <p role="alert" className="bad-t sm" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div className="pu-foot">
        <span />
        <span className="hstack">
          <button type="button" className={btnOutline} onClick={() => go(false)} disabled={pending} autoFocus>
            Log, keep it open
          </button>
          <button type="button" className={btnPrimary} onClick={() => go(true)} disabled={pending}>
            Log and mark lost — wrong number
          </button>
        </span>
      </div>
    </>
  );
}

/**
 * The phone and Log call on a row, a card or a line of Today: Call (the
 * phone's own dialler), WhatsApp where the lead view shows it (the
 * person's own WhatsApp; we send nothing), and Log call, which opens the
 * same sheet as the lead page. Only drawn for leads the member may log
 * calls on; the server checks again.
 */
export function RowCall({
  lead,
  stages,
  whatsapp = false,
  compact = false,
  onLogged,
}: {
  lead: CallSheetLead;
  stages: CallSheetStage[];
  whatsapp?: boolean;
  compact?: boolean;
  onLogged?: (r: CallLogged) => void;
}) {
  const [open, setOpen] = useState(false);
  const tel = telLink(lead.phone);
  const wa = whatsapp ? whatsappLink(lead.phone) : null;
  return (
    <span className="hstack" style={{ gap: 6, flexWrap: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
      {tel ? (
        <a href={tel} className={compact ? 'cl-iconbtn' : 'btn sec xs'} aria-label={`Call ${lead.name}`} title={`Call ${lead.phone ?? ''}`} draggable={false}>
          <LineIcon name="phone" size={compact ? 15 : 14} />
          {compact ? null : 'Call'}
        </a>
      ) : null}
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={compact ? 'cl-iconbtn' : 'btn sec xs'} aria-label={`WhatsApp ${lead.name}`} title={`Opens your own WhatsApp chat with ${lead.name}. We send nothing.`} draggable={false}>
          <LineIcon name="chat" size={compact ? 15 : 14} />
          {compact ? null : 'WhatsApp'}
        </a>
      ) : null}
      <button type="button" className={compact ? 'btn ghost xs' : 'btn sec xs'} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Log a call with ${lead.name}`} draggable={false}>
        Log call
      </button>
      {open ? <CallSheet lead={lead} stages={stages} onClose={() => setOpen(false)} onLogged={onLogged} /> : null}
    </span>
  );
}
