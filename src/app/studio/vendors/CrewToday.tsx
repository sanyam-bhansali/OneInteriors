import Link from 'next/link';
import { formatINR } from '@/lib/money';
import { crewToday } from '@/modules/studio-crews/store';

const day = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : null);

/**
 * What Today says about crews (Studio OS Phase 3 §5). The PM: lines with no
 * quantity yet, and work orders whose linked steps are all ticked but not
 * marked work done. Accounts and the owner: work done and still owed, or due
 * within a week. Reminders on screen only; nothing is sent.
 */
export async function CrewToday() {
  const t = await crewToday();
  if (!t || (t.toMeasure.length === 0 && t.toMarkDone.length === 0 && t.toPay.length === 0)) return null;
  const li = 'flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--s-rule)] py-2 text-[13.5px] first:border-t-0';
  return (
    <section className="s-card flex flex-col gap-3 p-5" aria-label="Crews">
      <h2 className="m-0 text-[15.5px] font-semibold">Crews</h2>
      {t.toMarkDone.length ? (
        <div>
          <p className="s-label m-0 mb-1">Mark the work done</p>
          <ul className="m-0 list-none p-0">
            {t.toMarkDone.map((x) => (
              <li key={`${x.projectId}-${x.number}`} className={li}>
                <span>
                  {x.crewName} · WO-{x.number} · {x.projectName} <span className="text-[12.5px] text-[var(--s-ink-3)]">· its steps are all ticked</span>
                </span>
                <Link href={`/studio/projects/${x.projectId}?tab=crews`} className="text-[13px] text-[var(--s-accent)]">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {t.toMeasure.length ? (
        <div>
          <p className="s-label m-0 mb-1">Lines to measure</p>
          <ul className="m-0 list-none p-0">
            {t.toMeasure.map((x) => (
              <li key={x.projectId} className={li}>
                <span>
                  {x.projectName} · {x.lines} line{x.lines === 1 ? '' : 's'} with no quantity
                </span>
                <Link href={`/studio/projects/${x.projectId}?tab=crews`} className="text-[13px] text-[var(--s-accent)]">
                  Enter quantities
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {t.toPay.length ? (
        <div>
          <p className="s-label m-0 mb-1">Crews to pay</p>
          <ul className="m-0 list-none p-0">
            {t.toPay.slice(0, 12).map((x) => (
              <li key={x.id} className={li}>
                <span>
                  {x.crewName} · {x.projectName}{' '}
                  <span className="text-[12.5px] text-[var(--s-ink-3)]">· {x.workDone ? 'work done' : `due ${day(x.dueOn)}`}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="s-num font-[family-name:var(--font-mono)] font-semibold">{formatINR(x.balancePaise)}</span>
                  <Link href={`/studio/vendors/orders/${x.id}`} className="text-[13px] text-[var(--s-accent)]">
                    Pay
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
