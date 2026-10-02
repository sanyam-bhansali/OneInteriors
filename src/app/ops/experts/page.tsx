import type { Metadata } from 'next';
import { Container } from '@/components/ui';
import { expertCalendar, availableSlots } from '@/modules/consultation/availability';
import { OpsHeader } from '../ui';
import { AddHoursForm, BlockDayForm, DAYS } from './HoursForms';
import { removeHoursAction, unblockDayAction } from './actions';

export const metadata: Metadata = {
  title: 'Expert hours',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const time = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

/**
 * When customers can book the expert call (plan §9).
 *
 * Weekly hours per person, and the days they are away. Customers see real
 * 30-minute slots from these for the next ten days; with none set anywhere,
 * the expert page falls back to asking when suits them. The database refuses
 * a double booking, so two customers can never take one slot.
 */
export default async function ExpertHoursPage() {
  const [{ team, hours, blocks }, slots] = await Promise.all([expertCalendar(), availableSlots()]);

  return (
    <>
      <OpsHeader />
      <main className="py-8">
        <Container size="wide">
          <p className="label m-0 mb-2">Expert hours</p>
          <h1 className="h1 mb-3">When customers can book the call.</h1>
          <p className="m-0 mb-8 max-w-[66ch] text-[15.5px] leading-relaxed text-[var(--color-ink-2)]">
            Hours are in India time, on the hour or the half-hour. Customers see open half-hours for
            the next ten days, starting three hours from now — {slots.length} open right now.
            {slots.length === 0 ? ' With none open, the expert page asks when suits them instead.' : ''}
          </p>

          <div className="flex flex-col gap-8">
            {team.map((person) => {
              const mine = hours.filter((h) => h.expertUserId === person.id);
              const away = blocks.filter((b) => b.expertUserId === person.id);
              return (
                <section key={person.id} className="rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper)] p-5">
                  <h2 className="m-0 mb-3 text-[16px] font-semibold text-[var(--color-ink)]">
                    {person.name ?? person.email ?? 'Team member'}
                  </h2>
                  {mine.length > 0 ? (
                    <ul className="m-0 mb-3 flex list-none flex-col gap-1.5 p-0">
                      {mine.map((h) => (
                        <li key={h.id} className="flex items-center gap-3 text-[14px]">
                          <span className="w-28">{DAYS[h.weekday]}</span>
                          <span className="font-[family-name:var(--font-mono)] tabular-nums">
                            {time(h.startMin)}–{time(h.endMin)}
                          </span>
                          <form action={removeHoursAction}>
                            <input type="hidden" name="id" value={h.id} />
                            <button type="submit" className="text-[13px] text-[var(--color-ink-3)] underline">
                              Remove
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 mb-3 text-[13.5px] text-[var(--color-ink-3)]">No hours set — not bookable.</p>
                  )}
                  <AddHoursForm expertUserId={person.id} />

                  <div className="mt-5 border-t border-[var(--color-rule)] pt-4">
                    {away.length > 0 ? (
                      <ul className="m-0 mb-3 flex list-none flex-col gap-1.5 p-0">
                        {away.map((b) => (
                          <li key={b.id} className="flex items-center gap-3 text-[14px]">
                            <span className="font-[family-name:var(--font-mono)] tabular-nums">{b.day}</span>
                            <span className="text-[var(--color-ink-2)]">{b.reason ?? 'Away'}</span>
                            <form action={unblockDayAction}>
                              <input type="hidden" name="id" value={b.id} />
                              <button type="submit" className="text-[13px] text-[var(--color-ink-3)] underline">
                                Remove
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <BlockDayForm expertUserId={person.id} />
                  </div>
                </section>
              );
            })}
          </div>
        </Container>
      </main>
    </>
  );
}
