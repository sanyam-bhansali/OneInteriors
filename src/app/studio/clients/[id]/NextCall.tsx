'use client';

import { useEffect, useState } from 'react';
import { whenLabel } from '@/modules/studio-sales/call-schedule';
import { Said, useAct } from '../../SalesUi';
import { CallWhen, callWhen, type CallWhenValue } from '../../CallWhen';
import { bulkFollowUpAction } from '../list-actions';

/**
 * The lead's next step and when (AxLeads, 12 Oct 2026): what is due, and a
 * one-tap reschedule — Later today, Tomorrow (default), or a date and time.
 */
export function NextCall({ leadId, action, on, may, children }: { leadId: string; action: string | null; on: Date | null; may: boolean; /** Shown under the next call (the page's next-step button). */ children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState(action ?? 'Call back');
  const [when, setWhen] = useState<CallWhenValue>(() => callWhen('tomorrow'));
  const { pending, result, run } = useAct();
  const late = on !== null && new Date(on).getTime() < Date.now();
  /* The header's "+ Action → Schedule a call" opens this. */
  useEffect(() => {
    const h = () => {
      if (may && window.location.hash === '#schedule-call') setOpen(true);
    };
    h();
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, [may]);

  return (
    <section id="next" className="card cl-next" style={{ scrollMarginTop: 80 }}>
      <div className="chead">
        <span className="hstack" style={{ gap: 10 }}>
          <h2>Next step</h2>
          {late ? (
            <span className="chip bad">
              <span className="dot" />
              Late
            </span>
          ) : null}
        </span>
        {may && !open ? (
          <button type="button" onClick={() => setOpen(true)} className="btn ghost sm">
            {on ? 'Change' : 'Schedule a call'}
          </button>
        ) : null}
      </div>
      <p style={{ margin: 0, fontSize: 16, color: late ? 'var(--bad)' : 'var(--ink)' }} suppressHydrationWarning>
        {on ? `${action ?? 'Follow up'} · ${whenLabel(new Date(on), new Date())}${late ? ' · late' : ''}` : 'Nothing scheduled.'}
      </p>
      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="text" aria-label="What to do" value={what} onChange={(e) => setWhat(e.target.value)} className="fld" />
          <CallWhen value={when} onChange={setWhen} />
          <div className="hstack" style={{ gap: 8 }}>
            <button
              type="button"
              disabled={pending || !when.day || (when.mode === 'pick' && !when.time)}
              onClick={() => run(() => bulkFollowUpAction({ ids: [leadId] }, when.day, when.time, what), (r) => r.ok && setOpen(false))}
              className="btn pri sm"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn sec sm">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {children}
      <Said result={result} />
    </section>
  );
}
