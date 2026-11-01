import { formatINR } from '@/lib/money';
import { priceChange } from '@/modules/project/decision-rules';
import type { StudioDecisions } from '@/modules/project/decision-flow';
import { CustomerSees } from '../marks';

/**
 * The customer's decisions on the project workspace (studio workspace
 * Phase 5): what is waiting on them and by when, what they picked and what it
 * changed, and the New decision button. The studio's cost per option shows
 * only to those who may create decisions, inside an "Only your team" line.
 */

const muted = 'text-[12.5px] text-[var(--muted)]';
const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', '');

/** `data` is read once by the workspace page (decision-flow.ts `studioDecisions`), which also shows the New decision button in its head. */
export function DecisionsCard({ data, customer }: { data: StudioDecisions; customer: string }) {
  const open = data.decisions.filter((d) => d.state !== 'picked');
  const picked = data.decisions.filter((d) => d.state === 'picked');
  return (
    <section className="sidecard" aria-label="Decisions">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="t m-0">Decisions</h2>
        <CustomerSees name={customer} />
      </div>
      {data.decisions.length === 0 && data.drawings.length === 0 ? <p className={`m-0 ${muted}`}>Nothing asked yet. {customer}&rsquo;s pick updates the quote, the final payment and the locker by itself.</p> : null}
      {data.drawings.length > 0 ? (
        /* Drawings shared for approval and what the client said (walkthrough, 27 Oct 2026). */
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Drawings for approval">
          {data.drawings.map((d) => (
            <li key={d.documentId} className="flex flex-col gap-0.5 border-t border-[var(--fill2)] pt-2.5 text-[13.5px]">
              <span className="font-medium">
                {d.kind} · v{d.version}
              </span>
              {d.state === 'approved' ? (
                <span className="text-[var(--good)]">
                  {d.kind === 'Catalogue to choose from' ? 'Picked' : 'Approved'} by {customer} · {shortDay(d.at)}
                </span>
              ) : d.state === 'changes' ? (
                <span className="text-[var(--bad)]">Changes asked · {shortDay(d.at)}</span>
              ) : (
                <span className="text-[var(--warn)]">Waiting on {customer} since {shortDay(d.at)}</span>
              )}
              {d.comment ? <span className="whitespace-pre-wrap">&ldquo;{d.comment}&rdquo;</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {[...open, ...picked].map((d) => {
          const pick = d.options.find((o) => o.id === d.pickedOptionId) ?? null;
          return (
            <li key={d.id} id={`decision-${d.id}`} className="flex flex-col gap-1 border-t border-[var(--fill2)] pt-2.5 text-[13.5px]">
              <span className="font-medium">{d.title}</span>
              {/* The client's "None of these" (1 Nov 2026): post a new decision with other options. */}
              {d.redo ? (
                <span className="chip warn" style={{ alignSelf: 'flex-start' }}>
                  {`Asks for other options${d.redo.note ? `: ${d.redo.note}` : ''}`}
                </span>
              ) : null}
              {pick ? (
                <span className="text-[var(--good)]">
                  Picked: {pick.label} · {priceChange(pick.deltaPaise)}
                  {d.pickedAt ? <span className={muted}> · {shortDay(d.pickedAt)}</span> : null}
                </span>
              ) : d.state === 'late' ? (
                <span className="text-[var(--bad)]">Past {shortDay(d.dueOn)}, not picked · a delay from here is {customer}&rsquo;s</span>
              ) : (
                <span className="text-[var(--warn)]">Waiting on {customer} · due {shortDay(d.dueOn)}</span>
              )}
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {d.options.map((o) => (
                  <li key={o.id} className={`${muted} flex flex-wrap gap-x-2`}>
                    <span className={o.id === d.pickedOptionId ? 'font-semibold text-[var(--ink)]' : undefined}>{o.label}</span>
                    <span className="mono">{priceChange(o.deltaPaise)}</span>
                    {o.studioCostDeltaPaise !== null ? (
                      <span className="mono" title="Only your team">
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
