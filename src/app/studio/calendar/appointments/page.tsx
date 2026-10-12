import { isLive } from '@/modules/studio/features';
import { ComingSoon } from '../../ComingSoon';
import type { Metadata } from 'next';
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
import { AppointmentActions } from '../AppointmentActions';
import { ProposeTime } from '../ProposeTime';
import '../../office-ui.css';
import '../calendar.css';

export const metadata: Metadata = {
  title: 'One Interiors visits',
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
export default async function AppointmentsPage() {
  /* Not in the pilot. The rail already stops linking here; this stops a
     bookmark or a typed URL reaching a screen we are not standing behind
     yet. Flip the flag in modules/studio/features.ts to ship it. */
  if (!isLive('calendar')) return <ComingSoon feature="calendar" />;

  const all = await myAppointments();

  const next = upcoming(all);
  const outstanding = needsOutcome(all);
  const past = all
    .filter((a) => !next.includes(a) && !outstanding.includes(a))
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .slice(0, 20);

  return (
    <main className="content ox-page">
      <div className="phead">
        <div>
          <span className="eyebrow">One Interiors visits</span>
          <h1>{next.length === 0 ? 'Nothing booked.' : `${next.length} meeting${next.length === 1 ? '' : 's'} coming up.`}</h1>
          <p className="muted" style={{ maxWidth: '68ch' }}>
            Meetings and site visits with customers who chose you. These appear once an expert has been on the call and the customer has picked you — there is no way to
            book one before that, which is what stops you being one of four studios someone is auditioning.
          </p>
        </div>
      </div>

      {outstanding.length > 0 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-labelledby="h-happen">
          <div>
            <h2 id="h-happen" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
              Did these happen?
            </h2>
            <p className="muted sm" style={{ margin: '4px 0 0', maxWidth: '58ch' }}>
              The time has passed and nobody has said how it went. We do not assume — a missed appointment has too many innocent explanations for us to guess at one.
            </p>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {outstanding.map((a) => (
              <AppointmentCard key={a.id} appointment={a} highlight />
            ))}
          </ul>
        </section>
      ) : null}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-labelledby="h-next">
        <h2 id="h-next" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
          Coming up
        </h2>
        {next.length === 0 ? (
          <div className="empty">
            <b>Nothing yet</b>
            <span className="muted sm" style={{ maxWidth: '62ch' }}>
              This fills up after expert calls — if it has been quiet for a while, the answer is usually earlier than this page: how many briefs you are appearing in,
              which your home page shows.
            </span>
          </div>
        ) : (
          groupByDay(next).map((day) => (
            <div key={day.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="cal-dayh">{day.label}</p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {day.items.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {past.length > 0 ? (
        <section className="card flush" aria-labelledby="h-earlier">
          <div className="chead">
            <h2 id="h-earlier">Earlier</h2>
          </div>
          <div className="tscroll">
            <table className="tbl" style={{ minWidth: 520 }}>
              <tbody>
                {past.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {formatSlot(a.startsAt)} · {KIND_LABELS[a.kind]}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
                        {a.noShowBy ? (
                          <span className="chip bad">
                            <span className="dot" />
                            {a.noShowBy === 'STUDIO' ? 'You did not attend' : 'Customer did not attend'}
                          </span>
                        ) : null}
                        <span className={a.status === 'COMPLETED' ? 'chip good' : 'chip'}>{STATUS_LABELS[a.status]}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
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
    <li className={`card cal-visit${highlight ? ' hl' : ''}`}>
      <div className="chead">
        <h2 className="mono" style={{ fontSize: 18 }}>
          {formatSlot(appointment.startsAt)}
        </h2>
        <span className={appointment.status === 'CONFIRMED' ? 'chip good' : 'chip'}>
          <span className="dot" />
          {STATUS_LABELS[appointment.status]}
        </span>
      </div>

      <span className="evt k-site" style={{ alignSelf: 'flex-start' }}>
        <b>{KIND_LABELS[appointment.kind]}</b>
        <span>{[property, locality, appointment.location].filter(Boolean).join(' · ')}</span>
      </span>

      {/* The contact block. `customerName` and `customerPhone` are already null
          unless the release rule allowed them — this only explains why. */}
      {appointment.contact.visible ? (
        <p style={{ margin: 0, fontSize: 15 }}>
          <b style={{ fontWeight: 600 }}>{appointment.customerName ?? 'Customer'}</b>
          {appointment.customerPhone ? (
            <>
              {' · '}
              <a href={`tel:${appointment.customerPhone}`} className="mono ox-link">
                {appointment.customerPhone}
              </a>
            </>
          ) : null}
        </p>
      ) : (
        <p className="sm" style={{ margin: 0, maxWidth: '58ch', padding: '10px 14px', borderRadius: 12, background: 'var(--soft)', color: 'var(--text2)' }}>
          {appointment.contact.message}
        </p>
      )}

      <AppointmentActions id={appointment.id} status={appointment.status} passed={hasPassed(appointment)} />

      {/* Offered where it is actually needed: a slot that does not work, or one
          that has lapsed unconfirmed. Not on a confirmed future meeting, where
          the useful action is to keep it. */}
      {appointment.status === 'PROPOSED' || hasPassed(appointment) ? <ProposeTime introductionId={appointment.introductionId} /> : null}
    </li>
  );
}
