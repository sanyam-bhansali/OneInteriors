import Link from 'next/link';
import { formatINR } from '@/lib/money';
import { priceChange } from '@/modules/project/decision-rules';
import { studioDecisions } from '@/modules/project/decision-flow';
import { CustomerSees } from '../marks';

/**
 * The customer's decisions on the project workspace (studio workspace
 * Phase 5): what is waiting on them and by when, what they picked and what it
 * changed, and the New decision button. The studio's cost per option shows
 * only to those who may create decisions, inside an "Only your team" line.
 */

const muted = 'text-[12.5px] text-[var(--s-ink-3)]';
const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', '');

export async function DecisionsCard({ projectId, customer }: { projectId: string; customer: string }) {
  const data = await studioDecisions(projectId);
  if (!data) return null;
  const open = data.decisions.filter((d) => d.state !== 'picked');
  const picked = data.decisions.filter((d) => d.state === 'picked');
  return (
    <section className="s-card flex flex-col gap-3 p-4" aria-label="Decisions">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[15px] font-semibold">Decisions</h2>
        <CustomerSees name={customer} />
      </div>
      {data.canCreate ? (
        <Link href={`/studio/projects/${projectId}/decisions/new`} className="s-btn self-start no-underline">
          New decision for {customer}
        </Link>
      ) : null}
      {data.decisions.length === 0 ? <p className={`m-0 ${muted}`}>Nothing asked yet. {customer}&rsquo;s pick updates the quote, the final payment and the locker by itself.</p> : null}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {[...open, ...picked].map((d) => {
          const pick = d.options.find((o) => o.id === d.pickedOptionId) ?? null;
          return (
            <li key={d.id} className="flex flex-col gap-1 border-t border-[var(--s-rule)] pt-2.5 text-[13.5px]">
              <span className="font-medium">{d.title}</span>
              {pick ? (
                <span className="text-[var(--s-good)]">
                  Picked: {pick.label} · {priceChange(pick.deltaPaise)}
                  {d.pickedAt ? <span className={muted}> · {shortDay(d.pickedAt)}</span> : null}
                </span>
              ) : d.state === 'late' ? (
                <span className="text-[var(--s-bad)]">Past {shortDay(d.dueOn)}, not picked · a delay from here is {customer}&rsquo;s</span>
              ) : (
                <span className="text-[var(--s-warn)]">Waiting on {customer} · due {shortDay(d.dueOn)}</span>
              )}
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {d.options.map((o) => (
                  <li key={o.id} className={`${muted} flex flex-wrap gap-x-2`}>
                    <span className={o.id === d.pickedOptionId ? 'font-semibold text-[var(--s-ink)]' : undefined}>{o.label}</span>
                    <span className="s-num font-[family-name:var(--font-mono)]">{priceChange(o.deltaPaise)}</span>
                    {o.studioCostDeltaPaise !== null ? (
                      <span className="s-num font-[family-name:var(--font-mono)]" title="Only your team">
                        · your cost {o.studioCostDeltaPaise >= 0 ? '+' : '−'}
                        {formatINR(Math.abs(o.studioCostDeltaPaise))}
                      </span>
                    ) : null}
                    {o.votes ? <span>· {o.votes} vote{o.votes === 1 ? '' : 's'}</span> : null}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {data.canCreate && data.decisions.some((d) => d.options.some((o) => o.studioCostDeltaPaise !== null)) ? (
        <p className={`m-0 ${muted}`}>“Your cost” is only your team&rsquo;s; {customer} sees the price change.</p>
      ) : null}
    </section>
  );
}
