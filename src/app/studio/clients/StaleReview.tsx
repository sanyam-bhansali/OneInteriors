'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOST_LABELS, QUIET_AFTER_DAYS, type LostReasonName } from '@/modules/studio-practice/vocabulary';
import { inputClass, primaryClass, quietClass } from '../SalesUi';
import { bulkMarkLostAction, bulkSnoozeAction, staleLeadsAction } from './list-actions';
import { staleReviewQuery } from '@/modules/studio-sales/lead-filters';

type Row = Awaited<ReturnType<typeof staleLeadsAction>>['rows'][number];

/** Written per batch: AxLeads' 200. */
const BATCH = 200;
const NUDGE_KEY = 'studio.leads.nudge';
/** Today's India date, the popup's once-a-day key. */
const todayKey = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const fmt = (d: Date) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

/**
 * "N leads need attention" (AxLeads, 12 Oct 2026): open leads with no
 * contact in 7+ days and no follow-up still ahead. Review opens them all,
 * ticked; Snooze 7 days or Mark lost (one reason for the lot), 200 at a
 * time. Owner and PM see every lead's; a salesperson their own.
 */
export function StaleReview({ count, query }: { count: number; /** The page's filters (owner, source, …): the review works on the same leads the banner counts. */ query: string }) {
  const reviewQuery = staleReviewQuery(query);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [total, setTotal] = useState(count);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  /* Once a day, on opening Leads (AxLeads): "N leads need attention … Later /
     Review now". "Later" is remembered for the day in this browser. */
  const [nudge, setNudge] = useState(false);
  useEffect(() => {
    if (count === 0) return;
    try {
      if (window.localStorage.getItem(NUDGE_KEY) !== todayKey()) setNudge(true);
    } catch {
      /* No storage: no popup, the banner is still there. */
    }
  }, [count]);
  const dismissNudge = () => {
    setNudge(false);
    try {
      window.localStorage.setItem(NUDGE_KEY, todayKey());
    } catch {
      /* Not remembered; it may ask again. */
    }
  };
  const openReview = () => {
    setOpen(true);
    setAll(true);
    setSaid(null);
    void load(null);
  };

  if (count === 0 && !open) return null;

  async function load(after: string | null) {
    setLoading(true);
    const page = await staleLeadsAction(reviewQuery, after);
    setRows((r) => (after ? [...r, ...page.rows] : page.rows));
    setPicked((p) => new Set([...(after ? p : []), ...page.rows.map((r) => r.id)]));
    setNext(page.next);
    setTotal(page.total);
    setLoading(false);
  }

  async function act(kind: 'snooze' | 'lost') {
    setSaid(null);
    const run = (t: unknown) => (kind === 'snooze' ? bulkSnoozeAction(t) : bulkMarkLostAction(t, reason));
    let done = 0;
    const size = all ? total : picked.size;
    const batches = Math.ceil(size / BATCH);
    const ids = [...picked];
    for (let i = 0; i < batches; i += 1) {
      setWorking(`${kind === 'snooze' ? 'Snoozing' : 'Marking lost'}… ${Math.min(size, (i + 1) * BATCH).toLocaleString('en-IN')} of ${size.toLocaleString('en-IN')}`);
      /* "All" re-reads the first 200 still needing attention each time: the
         ones just done have left the list. */
      const r = await run(all ? { query: reviewQuery, limit: BATCH } : { ids: ids.slice(i * BATCH, (i + 1) * BATCH) });
      if (!r.ok) {
        setWorking(null);
        setSaid({ ok: false, text: `${r.error} ${done > 0 ? `${done.toLocaleString('en-IN')} were done before it stopped.` : ''}` });
        router.refresh();
        return;
      }
      done += Math.min(BATCH, size - i * BATCH);
    }
    setWorking(null);
    setSaid({ ok: true, text: kind === 'snooze' ? `Done. ${done.toLocaleString('en-IN')} snoozed for 7 days.` : `Done. ${done.toLocaleString('en-IN')} marked lost.` });
    setRows([]);
    setPicked(new Set());
    router.refresh();
  }

  const selected = all ? total : picked.size;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-[12px] border border-[var(--s-warn)]/35 bg-[var(--s-warn-wash)] px-3.5 py-2.5 text-[13px]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="flex-none text-[var(--s-warn)]">
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />
        </svg>
        <span className="min-w-0 flex-1">
          <b className="s-num">{count.toLocaleString('en-IN')}</b> {count === 1 ? 'lead needs' : 'leads need'} attention — no contact in {QUIET_AFTER_DAYS}+ days.
        </span>
        <button type="button" className={quietClass} onClick={openReview}>
          Review
        </button>
      </div>

      {nudge && !open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[22vh]" onClick={dismissNudge}>
          <div role="dialog" aria-modal="true" aria-labelledby="nudge-title" onClick={(e) => e.stopPropagation()} className="w-[min(420px,92vw)] rounded-[16px] bg-[var(--s-surface)] p-6 text-center shadow-[var(--s-lift)]">
            <div className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-full bg-[var(--s-warn-wash)] text-[var(--s-warn)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />
              </svg>
            </div>
            <h2 id="nudge-title" className="m-0 mb-1.5 text-[17px] font-bold">
              {count.toLocaleString('en-IN')} leads need attention
            </h2>
            <p className="m-0 mb-5 text-[13.5px] text-[var(--s-ink-2)]">These leads have had no contact in {QUIET_AFTER_DAYS}+ days. Review them to follow up, snooze, or close.</p>
            <div className="flex justify-center gap-2">
              <button type="button" onClick={dismissNudge} className={quietClass}>
                Later
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissNudge();
                  openReview();
                }}
                className={primaryClass}
              >
                Review now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="stale-title">
          <div className="flex max-h-[88dvh] w-full max-w-[44rem] flex-col rounded-[16px] bg-[var(--s-surface)] shadow-[var(--s-lift)]">
            <div className="flex items-baseline justify-between gap-3 border-b border-[var(--s-rule)] px-5 py-4">
              <h2 id="stale-title" className="m-0 text-[16px] font-semibold">
                Review stale leads <span className="text-[13px] font-normal text-[var(--s-ink-3)]">{total.toLocaleString('en-IN')} · no contact in {QUIET_AFTER_DAYS}+ days</span>
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-[var(--s-ink-2)] underline">
                Close
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-[13px]">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={all}
                  onChange={(e) => {
                    setAll(e.target.checked);
                    setPicked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set());
                  }}
                />
                Select all {total.toLocaleString('en-IN')}
              </label>
              <span className="text-[var(--s-ink-3)]">· {selected.toLocaleString('en-IN')} selected</span>
              <Link href={`/studio/clients?view=list&${reviewQuery}`} className="ml-auto text-[var(--s-accent)]" onClick={() => setOpen(false)}>
                Open as a list
              </Link>
            </div>

            <ul className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto border-y border-[var(--s-rule-soft)] p-0">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 border-b border-[var(--s-rule-soft)] px-5 py-2 text-[13.5px] last:border-b-0">
                  <input
                    type="checkbox"
                    aria-label={`Include ${r.name}`}
                    checked={all || picked.has(r.id)}
                    onChange={(e) => {
                      const p = new Set(all ? rows.map((x) => x.id) : picked);
                      if (e.target.checked) p.add(r.id);
                      else p.delete(r.id);
                      setAll(false);
                      setPicked(p);
                    }}
                  />
                  <Link href={`/studio/clients/${r.id}`} className="min-w-0 flex-1 truncate font-medium text-[var(--s-ink)] no-underline hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-[12.5px] text-[var(--s-ink-3)]">{r.lastContactedAt ? `last spoke ${fmt(r.lastContactedAt)}` : `never called · added ${fmt(r.createdAt)}`}</span>
                  {r.assignedToName ? <span className="hidden text-[12.5px] text-[var(--s-ink-2)] sm:inline">{r.assignedToName}</span> : null}
                </li>
              ))}
              {loading ? <li className="px-5 py-3 text-[13px] text-[var(--s-ink-3)]">Loading…</li> : null}
              {!loading && next ? (
                <li className="px-5 py-2.5">
                  <button type="button" onClick={() => void load(next)} className={quietClass}>
                    Show 50 more
                  </button>
                </li>
              ) : null}
            </ul>

            <div className="flex flex-wrap items-center gap-2 px-5 py-4">
              <button type="button" disabled={working !== null || selected === 0} onClick={() => void act('snooze')} className={primaryClass}>
                Snooze {QUIET_AFTER_DAYS}d
              </button>
              <select aria-label="Why were they lost" value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} w-auto py-1.5`}>
                <option value="">Lost because…</option>
                {(Object.keys(LOST_LABELS) as LostReasonName[]).map((k) => (
                  <option key={k} value={k}>
                    {LOST_LABELS[k]}
                  </option>
                ))}
              </select>
              <button type="button" disabled={working !== null || selected === 0 || !reason} onClick={() => void act('lost')} className={`${quietClass} text-[var(--s-bad)]`}>
                Mark Lost ({selected.toLocaleString('en-IN')})
              </button>
              {working ? <span className="text-[13px] text-[var(--s-ink-2)]">{working}</span> : null}
              {said ? (
                <span role={said.ok ? 'status' : 'alert'} className={`text-[13px] ${said.ok ? 'text-[var(--s-good)]' : 'text-[var(--s-bad)]'}`}>
                  {said.text}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
