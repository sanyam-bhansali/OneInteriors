'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOST_LABELS, QUIET_AFTER_DAYS, type LostReasonName } from '@/modules/studio-practice/vocabulary';
import { LineIcon } from '../ui/icons';
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
      <div className="banner" role="status">
        <LineIcon name="warn" size={19} />
        <span style={{ flex: 1, minWidth: 220 }}>
          <b>
            {count.toLocaleString('en-IN')} {count === 1 ? "client hasn't" : "clients haven't"} heard from you in {QUIET_AFTER_DAYS} days.
          </b>{' '}
          Review them to follow up, snooze or close.
        </span>
        <button type="button" className="btn sm" style={{ background: 'var(--warn)', color: 'var(--paper)' }} onClick={openReview}>
          Show them
        </button>
      </div>

      {nudge && !open ? (
        <div className="overlay" style={{ paddingTop: '22vh' }}>
          <button type="button" className="scrim" aria-label="Close, ask again tomorrow" onClick={dismissNudge} />
          <div role="dialog" aria-modal="true" aria-labelledby="nudge-title" className="cl-sheet" style={{ width: 'min(420px, 100%)', textAlign: 'center', alignItems: 'center', padding: 24, gap: 10 }}>
            <span className="evi" style={{ width: 48, height: 48, background: 'var(--warn-bg)', color: 'var(--warn)' }}>
              <LineIcon name="warn" size={22} />
            </span>
            <h2 id="nudge-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              {count.toLocaleString('en-IN')} {count === 1 ? 'client needs' : 'clients need'} you
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              No contact in {QUIET_AFTER_DAYS}+ days. Review them to follow up, snooze or close.
            </p>
            <div className="hstack" style={{ justifyContent: 'center', marginTop: 6 }}>
              <button type="button" onClick={dismissNudge} className="btn sec">
                Later
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissNudge();
                  openReview();
                }}
                className="btn pri"
              >
                Review now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="overlay" style={{ alignItems: 'center', padding: 16 }}>
          <button type="button" className="scrim" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="cl-sheet" role="dialog" aria-modal="true" aria-labelledby="stale-title" style={{ maxWidth: 720 }}>
            <div className="sh">
              <h2 id="stale-title">
                Leads gone quiet{' '}
                <span className="muted sm" style={{ fontWeight: 400 }}>
                  {total.toLocaleString('en-IN')} · no contact in {QUIET_AFTER_DAYS}+ days
                </span>
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="btn ghost sm">
                Close
              </button>
            </div>

            <div className="hstack sm" style={{ padding: '10px 18px', gap: 8 }}>
              <label className="hstack" style={{ gap: 6 }}>
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
              <span className="muted">· {selected.toLocaleString('en-IN')} selected</span>
              <Link href={`/studio/clients?view=list&${reviewQuery}`} className="cl-link" style={{ marginLeft: 'auto' }} onClick={() => setOpen(false)}>
                Open as a list
              </Link>
            </div>

            <ul className="cl-rows" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 18px', borderTop: '1px solid var(--fill2)', borderBottom: '1px solid var(--fill2)' }}>
              {rows.map((r) => (
                <li key={r.id}>
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
                  <Link href={`/studio/clients/${r.id}`} style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </Link>
                  <span className="muted sm">{r.lastContactedAt ? `last spoke ${fmt(r.lastContactedAt)}` : `never called · added ${fmt(r.createdAt)}`}</span>
                  {r.assignedToName ? <span className="sm hidden sm:inline">{r.assignedToName}</span> : null}
                </li>
              ))}
              {loading ? <li className="muted sm">Loading…</li> : null}
              {!loading && next ? (
                <li>
                  <button type="button" onClick={() => void load(next)} className="btn ghost sm">
                    Show 50 more
                  </button>
                </li>
              ) : null}
            </ul>

            <div className="sf">
              <button type="button" disabled={working !== null || selected === 0} onClick={() => void act('snooze')} className="btn pri sm">
                Snooze {QUIET_AFTER_DAYS} days
              </button>
              <select aria-label="Why were they lost" value={reason} onChange={(e) => setReason(e.target.value)} className="fld sm">
                <option value="">Lost because…</option>
                {(Object.keys(LOST_LABELS) as LostReasonName[]).map((k) => (
                  <option key={k} value={k}>
                    {LOST_LABELS[k]}
                  </option>
                ))}
              </select>
              <button type="button" disabled={working !== null || selected === 0 || !reason} onClick={() => void act('lost')} className="btn sec sm bad-b">
                Mark lost ({selected.toLocaleString('en-IN')})
              </button>
              {working ? <span className="sm muted">{working}</span> : null}
              {said ? (
                <span role={said.ok ? 'status' : 'alert'} className={said.ok ? 'cl-ok' : 'cl-err'}>
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
