import { formatINR } from '@/lib/money';
import type { BookingDraft, BookingToRecord, RecentBooking } from '@/modules/studio-sales/booking';
import { BookingBox, Refund } from '../clients/[id]/SalesPanels';

/**
 * Bookings on the payments desk (Studio OS Phase 1): the sales finals
 * waiting for their booking advance, each with the same "Record booking"
 * form as the lead page, and the bookings of the last two weeks with their
 * refund. Accounts works here; it never opens a lead.
 */
export function Bookings({
  waiting,
  drafts,
  recent,
  isOwner,
}: {
  waiting: BookingToRecord[];
  drafts: Record<string, BookingDraft | null>;
  recent: RecentBooking[];
  isOwner: boolean;
}) {
  if (waiting.length === 0 && recent.length === 0) return null;
  return (
    <>
      {waiting.length > 0 ? (
        <section className="card" aria-labelledby="h-booking">
          <div className="chead">
            <h2 id="h-booking">Waiting for the booking advance</h2>
            <span className="chip warn">
              <span className="dot" />
              <span className="mono">{waiting.length}</span> to record
            </span>
          </div>
          {waiting.map((w) => (
            <div key={w.quoteId} className="pay-wait">
              <p className="sm" style={{ margin: 0 }}>
                <b style={{ fontWeight: 600, fontSize: 14.5 }}>{w.client}</b>{' '}
                <span className="muted">
                  · {w.number} {w.revision} · {formatINR(w.totalPaise)}
                  {w.markedAt ? ` · sales final ${new Date(w.markedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                </span>
              </p>
              {drafts[w.quoteId] ? (
                <BookingBox clientId={w.clientId ?? ''} booking={null} draft={drafts[w.quoteId]!} mayRefund={false} isOwner={isOwner} seesProject={false} />
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
      {recent.length > 0 ? (
        <section className="card" aria-labelledby="h-booked">
          <div className="chead">
            <h2 id="h-booked">Booked in the last two weeks</h2>
          </div>
          <ul className="pay-recent">
            {recent.map((r) => (
              <li key={r.clientId}>
                <p className="sm" style={{ margin: 0 }}>
                  <b style={{ fontWeight: 600, fontSize: 14.5 }}>{r.name}</b>{' '}
                  <span className="muted">
                    · {formatINR(r.booking.advancePaise)} · booked {new Date(r.booking.bookedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </p>
                <Refund clientId={r.clientId} booking={r.booking} isOwner={isOwner} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
