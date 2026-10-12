'use client';

import { useEffect, useState } from 'react';
import { whenLabel } from '@/modules/studio-sales/call-schedule';
import { Said, useAct, inputClass, primaryClass, quietClass } from '../../SalesUi';
import { CallWhen, callWhen, type CallWhenValue } from '../../CallWhen';
import { bulkFollowUpAction } from '../list-actions';

/**
 * The lead's next step and when (AxLeads, 12 Oct 2026): what is due, and a
 * one-tap reschedule — Later today, Tomorrow (default), or a date and time.
 */
export function NextCall({ leadId, action, on, may }: { leadId: string; action: string | null; on: Date | null; may: boolean }) {
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
    <section id="next" className="scroll-mt-20 rounded-[12px] border border-[var(--s-rule)] px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="s-label m-0 text-[var(--s-ink-3)]">Next step</h2>
        {may && !open ? (
          <button type="button" onClick={() => setOpen(true)} className="text-[13px] text-[var(--s-accent)] underline">
            {on ? 'Change' : 'Schedule a call'}
          </button>
        ) : null}
      </div>
      <p className={`m-0 mt-1.5 text-[13.5px] ${late ? 'font-medium text-[var(--s-bad)]' : ''}`} suppressHydrationWarning>
        {on ? `${action ?? 'Follow up'} · ${whenLabel(new Date(on), new Date())}${late ? ' · late' : ''}` : 'Nothing scheduled.'}
      </p>
      {open ? (
        <div className="mt-3 flex flex-col gap-2.5">
          <input type="text" aria-label="What to do" value={what} onChange={(e) => setWhat(e.target.value)} className={inputClass} />
          <CallWhen value={when} onChange={setWhen} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !when.day || (when.mode === 'pick' && !when.time)}
              onClick={() => run(() => bulkFollowUpAction({ ids: [leadId] }, when.day, when.time, what), (r) => r.ok && setOpen(false))}
              className={primaryClass}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={quietClass}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <Said result={result} />
    </section>
  );
}
