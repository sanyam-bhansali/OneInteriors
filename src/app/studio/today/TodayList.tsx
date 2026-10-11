'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { TodayRow, TodaySection } from '@/modules/studio-sales/today-rules';
import { assignLeadsAction } from '../sales-actions';
import { Said, useAct, inputClass, primaryClass, quietClass } from '../SalesUi';

/**
 * The Today list: one card per section that has something in it, one row
 * per thing, one button per row. Sections with nothing in them are left out
 * rather than shown empty.
 */
export function TodayList({ sections, members, meId }: { sections: TodaySection[]; members: { id: string; name: string }[]; meId: string }) {
  const filled = sections.filter((s) => s.rows.length > 0);
  return (
    <div className="flex flex-col gap-5">
      {filled.map((s) => (
        <section key={s.id} className="s-card overflow-hidden" aria-labelledby={`today-${s.id}`}>
          <div className="flex items-baseline justify-between gap-3 bg-[var(--s-surface-2)] px-4 py-2.5">
            <h2 id={`today-${s.id}`} className="m-0 text-[14.5px] font-semibold">
              {s.title}
            </h2>
            <span className="s-num text-[12.5px] text-[var(--s-ink-3)]">{s.rows.length + s.more}</span>
          </div>
          {s.id === 'pool' && members.length > 0 ? <AssignAll ids={s.rows.map((r) => r.leadId!).filter(Boolean)} members={members} /> : null}
          <ul className="m-0 flex list-none flex-col p-0">
            {s.rows.map((r) => (
              <Row key={r.key} row={r} members={members} meId={meId} />
            ))}
          </ul>
          {s.more > 0 ? (
            <p className="m-0 border-t border-[var(--s-rule-soft)] px-4 py-2.5 text-[13px] text-[var(--s-ink-3)]">
              And {s.more} more.{' '}
              <Link href={s.id === 'pool' ? '/studio/clients/pool' : '/studio/clients'} className="text-[var(--s-accent)]">
                See them all
              </Link>
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function Row({ row, members, meId }: { row: TodayRow; members: { id: string; name: string }[]; meId: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--s-rule-soft)] px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        {row.leadId ? (
          <Link href={`/studio/clients/${row.leadId}`} className="text-[14.5px] font-medium text-[var(--s-ink)] no-underline hover:underline">
            {row.title}
          </Link>
        ) : (
          <span className="text-[14.5px] font-medium">{row.title}</span>
        )}
        <p className={`m-0 mt-0.5 text-[13px] leading-snug ${row.late ? 'font-medium text-[var(--s-accent)]' : 'text-[var(--s-ink-2)]'}`}>{row.detail}</p>
      </div>
      {row.action.kind === 'assign' && row.leadId ? (
        <AssignOne leadId={row.leadId} members={members} meId={meId} />
      ) : (
        <Link href={row.action.href} className={row.action.kind === 'call' ? primaryClass : quietClass}>
          {row.action.label}
        </Link>
      )}
    </li>
  );
}

function AssignOne({ leadId, members, meId }: { leadId: string; members: { id: string; name: string }[]; meId: string }) {
  const [to, setTo] = useState('');
  const { pending, result, run } = useAct();
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-2">
        <select aria-label="Give this lead to" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} w-[11rem] py-1.5 text-[13px]`}>
          <option value="">Give to…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === meId ? `${m.name} (me)` : m.name}
            </option>
          ))}
        </select>
        <button type="button" disabled={pending || !to} onClick={() => run(() => assignLeadsAction([leadId], to))} className={primaryClass}>
          {pending ? 'Assigning…' : 'Assign'}
        </button>
      </div>
      <Said result={result} />
    </div>
  );
}

/** Every lead in the pool to one person, in one go (asks first). */
function AssignAll({ ids, members }: { ids: string[]; members: { id: string; name: string }[] }) {
  const [to, setTo] = useState('');
  const [sure, setSure] = useState(false);
  const { pending, result, run } = useAct();
  if (ids.length < 2) return null;
  return (
    <div className="border-b border-[var(--s-rule-soft)] px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-[var(--s-ink-2)]">Give all {ids.length} shown to</span>
        <select aria-label="Give all these leads to" value={to} onChange={(e) => { setTo(e.target.value); setSure(false); }} className={`${inputClass} w-[11rem] py-1.5 text-[13px]`}>
          <option value="">pick a person…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {to ? (
          sure ? (
            <button type="button" disabled={pending} onClick={() => run(() => assignLeadsAction(ids, to), () => setSure(false))} className={primaryClass}>
              {pending ? 'Assigning…' : `Yes, give all ${ids.length}`}
            </button>
          ) : (
            <button type="button" onClick={() => setSure(true)} className={quietClass}>
              Assign all
            </button>
          )
        ) : null}
      </div>
      <Said result={result} />
    </div>
  );
}
