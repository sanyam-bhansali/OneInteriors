import Link from 'next/link';
import { formatINR } from '@/lib/money';
import { crewToday } from '@/modules/studio-crews/store';
import '../office-ui.css';

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
  const li = 'ox-crow';
  return (
    <section className="card" aria-labelledby="h-crews-today" style={{ gap: 10 }}>
      <div className="chead">
        <h2 id="h-crews-today">Crews</h2>
        <Link href="/studio/vendors/pay" className="sm acc-t" style={{ fontWeight: 600 }}>
          Pay crews
        </Link>
      </div>
      {t.toMarkDone.length ? (
        <div>
          <span className="lbl">Mark the work done</span>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {t.toMarkDone.map((x) => (
              <li key={`${x.projectId}-${x.number}`} className={li}>
                <span>
                  {x.crewName} · <span className="mono">WO-{x.number}</span> · {x.projectName} <span className="muted sm">· its steps are all ticked</span>
                </span>
                <Link href={`/studio/projects/${x.projectId}?tab=crews`} className="btn ghost sm">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {t.toMeasure.length ? (
        <div>
          <span className="lbl">Lines to measure</span>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {t.toMeasure.map((x) => (
              <li key={x.projectId} className={li}>
                <span>
                  {x.projectName} · {x.lines} line{x.lines === 1 ? '' : 's'} with no quantity
                </span>
                <Link href={`/studio/projects/${x.projectId}?tab=crews`} className="btn ghost sm">
                  Enter quantities
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {t.toPay.length ? (
        <div>
          <span className="lbl">Crews to pay</span>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {t.toPay.slice(0, 12).map((x) => (
              <li key={x.id} className={li}>
                <span>
                  {x.crewName} · {x.projectName}{' '}
                  <span className="muted sm">· {x.workDone ? 'work done' : `due ${day(x.dueOn)}`}</span>
                </span>
                <span className="hstack" style={{ gap: 10, flexWrap: 'nowrap' }}>
                  <b className="mono" style={{ fontWeight: 600 }}>
                    {formatINR(x.balancePaise)}
                  </b>
                  <Link href={`/studio/vendors/orders/${x.id}`} className="btn pri sm">
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
