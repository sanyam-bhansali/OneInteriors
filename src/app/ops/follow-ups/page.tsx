import type { Metadata } from 'next';
import { Container, Pill } from '@/components/ui';
import { OpsHeader } from '../ui';
import { followUpList } from '@/modules/consultation/follow-up-store';
import {
  FOLLOW_UP_OUTCOMES,
  MAX_TRIES,
  OUTCOME_LABELS,
  TARGET_HOURS,
  WINDOW_DAYS,
  ago,
  isOutcome,
} from '@/modules/consultation/follow-up';
import { localityLabel } from '@/modules/brief/types';
import { recordFollowUpAction } from './actions';

export const metadata: Metadata = { title: 'Follow-up calls', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Today's follow-up calls: customers who finished the brief and left a number
 * but have not booked the expert call. The pilot's biggest lever on the
 * brief → call rate (docs/FUTURE-REQUIREMENTS.md explains why nothing is
 * withheld instead).
 */
export default async function FollowUpsPage() {
  const now = new Date();
  const rows = await followUpList(now);
  const overdue = rows.filter((r) => r.overdue).length;

  return (
    <>
      <OpsHeader />
      <main className="py-8">
        <Container size="wide">
          <p className="label m-0 mb-2">Follow-up calls</p>
          <h1 className="h1 mb-3">
            {rows.length === 0 ? 'Nobody to call right now.' : `${rows.length} to call${overdue ? ` · ${overdue} past ${TARGET_HOURS} hours` : ''}`}
          </h1>
          <p className="m-0 mb-8 max-w-[70ch] text-[15px] leading-relaxed text-[var(--color-ink-2)]">
            Everyone who finished their brief in the last {WINDOW_DAYS} days, left a number and has
            not booked the expert call. Call within {TARGET_HOURS} hours: &ldquo;I have read your
            quotes — would thirty minutes with our architect help?&rdquo; The call is free for them
            and books from /expert. A &ldquo;call back&rdquo; or &ldquo;no answer&rdquo; comes back
            the next day, up to {MAX_TRIES} tries.
          </p>

          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {rows.map((r) => (
              <li key={r.briefId} className="rounded-md border border-[var(--color-rule)] p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="m-0 text-[16px] font-semibold">
                    {r.name ?? 'No name given'}{' '}
                    <a href={`tel:${r.phone}`} className="ml-2 font-normal text-[var(--color-petrol)]">
                      {r.phone}
                    </a>
                  </p>
                  <p className="m-0 flex items-center gap-2 text-[13px] text-[var(--color-ink-3)]">
                    Brief finished {ago(r.completedAt, now)}
                    {r.overdue ? <Pill tone="atrisk">Past {TARGET_HOURS}h</Pill> : null}
                  </p>
                </div>
                <p className="m-0 mt-1 text-[13.5px] text-[var(--color-ink-2)]">
                  {[r.propertyType, localityLabel(r.locality), r.tier, `${r.matches} matched`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {r.outcome && isOutcome(r.outcome) ? (
                  <p className="m-0 mt-1 text-[13px] text-[var(--color-ink-3)]">
                    Last time: {OUTCOME_LABELS[r.outcome]} ({r.tries} of {MAX_TRIES} tries)
                    {r.note ? ` — ${r.note}` : ''}
                  </p>
                ) : null}

                <form action={recordFollowUpAction} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="briefId" value={r.briefId} />
                  <select
                    name="outcome"
                    required
                    defaultValue=""
                    className="rounded border border-[var(--color-rule)] bg-transparent px-2 py-1.5 text-[13.5px]"
                  >
                    <option value="" disabled>
                      What happened?
                    </option>
                    {FOLLOW_UP_OUTCOMES.map((o) => (
                      <option key={o} value={o}>
                        {OUTCOME_LABELS[o]}
                      </option>
                    ))}
                  </select>
                  <input
                    name="note"
                    placeholder="Note (optional)"
                    maxLength={1000}
                    className="min-w-[16rem] flex-1 rounded border border-[var(--color-rule)] bg-transparent px-2 py-1.5 text-[13.5px]"
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-[var(--color-petrol)] px-4 py-1.5 text-[13px] text-[var(--color-petrol)]"
                  >
                    Save
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Container>
      </main>
    </>
  );
}
