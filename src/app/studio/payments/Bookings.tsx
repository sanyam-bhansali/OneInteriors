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
    <div className="flex flex-col gap-4">
      {waiting.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-[16px] font-semibold">Waiting for the booking advance</h2>
          {waiting.map((w) => (
            <div key={w.quoteId} className="flex flex-col gap-2">
              <p className="m-0 text-[14px]">
                <span className="font-semibold">{w.client}</span>{' '}
                <span className="text-[var(--s-ink-3)]">
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
        <section className="s-card p-5">
          <h2 className="m-0 mb-2 text-[16px] font-semibold">Booked in the last two weeks</h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {recent.map((r) => (
              <li key={r.clientId} className="border-b border-[var(--s-rule-soft)] pb-3 last:border-b-0 last:pb-0">
                <p className="m-0 text-[14px]">
                  <span className="font-medium">{r.name}</span>{' '}
                  <span className="text-[var(--s-ink-3)]">
                    · {formatINR(r.booking.advancePaise)} · booked {new Date(r.booking.bookedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </p>
                <Refund clientId={r.clientId} booking={r.booking} isOwner={isOwner} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
