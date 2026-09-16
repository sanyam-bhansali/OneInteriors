import type { Metadata } from 'next';
import { Container, Pill } from '@/components/ui';
import {
  myAppointments,
  groupByDay,
  formatSlot,
  hasPassed,
  needsOutcome,
  upcoming,
  KIND_LABELS,
  STATUS_LABELS,
  type StudioAppointment,
} from '@/modules/studio/introduction';
import { PUNE_LOCALITIES, propertyLabel } from '@/modules/brief/types';
import { AppointmentActions } from './AppointmentActions';
import { ProposeTime } from './ProposeTime';

export const metadata: Metadata = {
  title: 'Calendar',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The studio's meetings and site visits.
 *
 * ## Why this page is agenda-first rather than a month grid
 *
 * A studio owner opens this on a phone between sites. A month grid at 360px is
 * decoration — twenty-eight boxes too small to read, and the one thing they
 * actually came for (what is next, and where) pushed below the fold. So the
 * agenda is the page, on every width.
 *
 * ## The rule that makes this page safe
 *
 * Customer names and phone numbers are redacted in `myAppointments()` at the
 * module boundary, not here — see `introduction-access.ts`. This component
 * cannot leak a contact detail by forgetting to branch, because by the time the
 * data reaches it the field is already null. What this page does is explain the
 * absence, which is the part a component should own.
 */
export default async function CalendarPage() {
  const all = await myAppointments();

  const next = upcoming(all);
  const outstanding = needsOutcome(all);
  const past = all
    .filter((a) => !next.includes(a) && !outstanding.includes(a))
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .slice(0, 20);

  return (
    <main className="py-10">
      <Container size="default">
        <p className="label m-0 mb-2">Calendar</p>
        <h1 className="h1 mb-3">
          {next.length === 0
            ? 'Nothing booked.'
            : `${next.length} meeting${next.length === 1 ? '' : 's'} coming up.`}
        </h1>
        <p className="m-0 mb-10 max-w-[62ch] text-[16px] leading-relaxed text-[var(--color-ink-2)]">
          Meetings and site visits with customers who chose you. These appear once an expert has
          been on the call and the customer has picked you — there is no way to book one before
          that, which is what stops you being one of four studios someone is auditioning.
        </p>

        {outstanding.length > 0 ? (
          <section className="mb-10">
            <h2 className="m-0 mb-1 font-[family-name:var(--font-display)] text-[22px] leading-tight">
              Did these happen?
            </h2>
            <p className="m-0 mb-4 max-w-[58ch] text-[14.5px] leading-relaxed text-[var(--color-ink-3)]">
              The time has passed and nobody has said how it went. We do not assume — a missed
              appointment has too many innocent explanations for us to guess at one.
            </p>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {outstanding.map((a) => (
                <AppointmentCard key={a.id} appointment={a} highlight />
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mb-12">
          <h2 className="m-0 mb-4 font-[family-name:var(--font-display)] text-[22px] leading-tight">
            Coming up
          </h2>

          {next.length === 0 ? (
            <p className="m-0 rounded-[12px] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-5 py-6 text-[15px] italic leading-relaxed text-[var(--color-ink-3)]">
              Nothing yet. This fills up after expert calls — if it has been quiet for a while, the
              answer is usually earlier than this page: how many briefs you are appearing in, which
              your home page shows.
            </p>
          ) : (
            groupByDay(next).map((day) => (
              <div key={day.key} className="mb-7">
                <p className="label m-0 mb-2.5">{day.label}</p>
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {day.items.map((a) => (
                    <AppointmentCard key={a.id} appointment={a} />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        {past.length > 0 ? (
          <section>
            <h2 className="m-0 mb-4 font-[family-name:var(--font-display)] text-[22px] leading-tight">
              Earlier
            </h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {past.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 border-b border-[var(--color-rule-soft)] py-3"
                >
                  <span className="text-[14.5px] text-[var(--color-ink-2)]">
                    {formatSlot(a.startsAt)} · {KIND_LABELS[a.kind]}
                  </span>
                  <span className="flex items-center gap-3">
                    {a.noShowBy ? (
                      <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.09em] text-[var(--color-atrisk)]">
                        {a.noShowBy === 'STUDIO' ? 'You did not attend' : 'Customer did not attend'}
                      </span>
                    ) : null}
                    <Pill tone={a.status === 'COMPLETED' ? 'ontrack' : 'neutral'}>
                      {STATUS_LABELS[a.status]}
                    </Pill>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </main>
  );
}

function AppointmentCard({
  appointment,
  highlight = false,
}: {
  appointment: StudioAppointment;
  highlight?: boolean;
}) {
  const locality =
    PUNE_LOCALITIES.find((l) => l.slug === appointment.locality)?.label ?? appointment.locality;
  const property = propertyLabel(appointment.propertyType);

  return (
    <li
      className={`rounded-[14px] border bg-[var(--color-paper-2)] p-5 ${
        highlight ? 'border-[var(--color-brass)]' : 'border-[var(--color-rule)]'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
        <span className="font-[family-name:var(--font-display)] text-[19px] leading-tight text-[var(--color-ink)]">
          {formatSlot(appointment.startsAt)}
        </span>
        <Pill tone={appointment.status === 'CONFIRMED' ? 'ontrack' : 'neutral'}>
          {STATUS_LABELS[appointment.status]}
        </Pill>
      </div>

      <p className="m-0 mb-3 text-[14.5px] text-[var(--color-ink-2)]">
        {[KIND_LABELS[appointment.kind], property, locality, appointment.location]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {/* The contact block. `customerName` and `customerPhone` are already null
          unless the release rule allowed them — this only explains why. */}
      {appointment.contact.visible ? (
        <p className="m-0 text-[15px] text-[var(--color-ink)]">
          {appointment.customerName ?? 'Customer'}
          {appointment.customerPhone ? (
            <>
              {' · '}
              <a
                href={`tel:${appointment.customerPhone}`}
                className="font-[family-name:var(--font-mono)] text-[14px] text-[var(--color-petrol)]"
              >
                {appointment.customerPhone}
              </a>
            </>
          ) : null}
        </p>
      ) : (
        <p className="m-0 max-w-[58ch] rounded-[8px] bg-[var(--color-paper-3)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
          {appointment.contact.message}
        </p>
      )}

      <AppointmentActions
        id={appointment.id}
        status={appointment.status}
        passed={hasPassed(appointment)}
      />

      {/* Offered where it is actually needed: a slot that does not work, or one
          that has lapsed unconfirmed. Not on a confirmed future meeting, where
          the useful action is to keep it. */}
      {appointment.status === 'PROPOSED' || hasPassed(appointment) ? (
        <ProposeTime introductionId={appointment.introductionId} />
      ) : null}
    </li>
  );
}
