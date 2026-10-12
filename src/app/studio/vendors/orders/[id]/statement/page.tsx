import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatINR } from '@/lib/money';
import { statementOf } from '@/modules/studio-crews/store';
import { qtyWords } from '@/modules/studio-crews/money';
import { CREW_UNIT_SHORT } from '@/modules/studio-crews/trades';
import { PrintButton } from './PrintButton';

export const metadata: Metadata = { title: 'Statement of account', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * A crew's statement of account for one work order (Studio OS Phase 3 §4,
 * Hauspire §3.11): lines by room, billed, extras, paid, balance; printed or
 * saved as PDF from the browser. A statement, not an invoice: the studio is
 * the payer and the crew raises its own bill. It opens only for the owner and
 * accounts signed in to the studio — crews have no login; the studio prints
 * it to PDF and sends that from its own WhatsApp.
 */
export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await statementOf(id.slice(0, 64));
  if (!s) notFound();
  const o = s.order;
  const m = o.money!;
  const rooms = [...new Set(o.lines.map((l) => l.room))];
  const pending = o.needPrice + o.needQty;
  const th = 'border-b border-[#ccc] px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#555]';
  const td = 'border-b border-[#eee] px-2 py-1.5 align-top';
  return (
    <div className="px-5 py-6 sm:px-7">
      {/* Print only the statement, not the studio's rail around it. */}
      <style>{`@media print { body * { visibility: hidden !important; } .crew-statement, .crew-statement * { visibility: visible !important; } .crew-statement { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; } .no-print { display: none !important; } }`}</style>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/studio/vendors/orders/${o.id}`} className="s-btn-ghost no-underline">
          ← Back to the work order
        </Link>
        <PrintButton />
        <span className="text-[12.5px] text-[var(--s-ink-3)]">Use &ldquo;Save as PDF&rdquo; to send it from your WhatsApp.</span>
      </div>
      <article className="crew-statement mx-auto max-w-[820px] bg-white p-8 text-[13px] text-[#1a1a1a] shadow-sm" style={{ border: '1px solid #e5e5e5' }}>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ccc] pb-4">
          <div>
            <p className="m-0 text-[18px] font-semibold">{s.studio.name}</p>
            {s.studio.address ? <p className="m-0 text-[12px] text-[#555]">{s.studio.address}</p> : null}
            <p className="m-0 mt-1 text-[13px] font-medium">Statement of account</p>
          </div>
          <div className="text-right text-[12px] text-[#555]">
            <p className="m-0">Reference {s.reference}</p>
            <p className="m-0">Generated {day(s.generatedOn)}</p>
            {o.dueOn ? <p className="m-0">Pay by {day(o.dueOn)}</p> : null}
          </div>
        </header>
        <section className="grid gap-4 border-b border-[#ccc] py-4 sm:grid-cols-2">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#555]">Crew</p>
            <p className="m-0 font-semibold">{s.crew.name}</p>
            <p className="m-0">{o.trades.map((t) => t.label).join(', ')}</p>
            {s.crew.phone ? <p className="m-0">{s.crew.phone}</p> : null}
            {s.crew.address ? <p className="m-0">{s.crew.address}</p> : null}
            {s.crew.pan ? <p className="m-0">PAN {s.crew.pan}</p> : null}
            {s.crew.kind === 'PERMANENT' ? <p className="m-0">Aadhaar {s.crew.aadhaar}</p> : null}
          </div>
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#555]">Site</p>
            <p className="m-0 font-semibold">{o.projectName}</p>
            <p className="m-0">Work order WO-{o.number}</p>
          </div>
        </section>
        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Work</th>
              <th className={`${th} text-right`}>Rate</th>
              <th className={`${th} text-right`}>Qty</th>
              <th className={`${th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <RoomBlock key={room} room={room} lines={o.lines.filter((l) => l.room === room)} td={td} />
            ))}
          </tbody>
        </table>
        {pending ? <p className="m-0 mt-3 text-[12px] text-[#7e5910]">{pending} line{pending === 1 ? ' is' : 's are'} still to be priced. This statement is provisional until they are.</p> : null}
        <table className="ml-auto mt-4 border-collapse text-[13px]">
          <tbody>
            <tr>
              <td className="px-2 py-1">Total billed</td>
              <td className="px-2 py-1 text-right font-mono">{formatINR(m.billPaise)}</td>
            </tr>
            {m.extrasPaise > 0 ? (
              <tr>
                <td className="px-2 py-1 text-[#555]">of which extra work</td>
                <td className="px-2 py-1 text-right font-mono text-[#555]">{formatINR(m.extrasPaise)}</td>
              </tr>
            ) : null}
            <tr>
              <td className="px-2 py-1">Paid to date</td>
              <td className="px-2 py-1 text-right font-mono">− {formatINR(m.paidPaise)}</td>
            </tr>
            <tr>
              <td className="border-t border-[#1a1a1a] px-2 py-1.5 font-semibold">{m.balancePaise < 0 ? 'Advance to recover' : 'Balance due'}</td>
              <td className="border-t border-[#1a1a1a] px-2 py-1.5 text-right font-mono font-semibold">{formatINR(Math.abs(m.balancePaise))}</td>
            </tr>
          </tbody>
        </table>
        {o.payments && o.payments.length ? (
          <>
            <p className="m-0 mt-6 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#555]">Payments</p>
            <table className="mt-1 w-full border-collapse">
              <tbody>
                {o.payments.map((p) => (
                  <tr key={p.id}>
                    <td className={td}>{day(p.paidOn)}</td>
                    <td className={td}>
                      {p.kind === 'ADVANCE' ? 'Advance' : p.kind === 'CORRECTION' ? 'Correction' : (p.note ?? 'Payment')}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </td>
                    <td className={td}>{p.mode}</td>
                    <td className={`${td} text-right font-mono`}>{formatINR(p.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
        <p className="m-0 mt-6 text-[11.5px] text-[#555]">
          A statement of account, not an invoice: {s.studio.name} pays for the work above. Please raise any disagreement before accepting the next payment.
        </p>
      </article>
    </div>
  );
}

function RoomBlock({ room, lines, td }: { room: string; lines: NonNullable<Awaited<ReturnType<typeof statementOf>>>['order']['lines']; td: string }) {
  return (
    <>
      <tr>
        <td colSpan={4} className="px-2 pb-1 pt-3 text-[12px] font-semibold">
          {room}
        </td>
      </tr>
      {lines.map((l) => {
        const q = l.measuredQtyMilli ?? l.qtyMilli;
        return (
          <tr key={l.id}>
            <td className={td}>
              {l.product}
              {l.isExtra ? ' (extra)' : ''}
              <span className="block text-[11.5px] text-[#666]">{l.item}</span>
            </td>
            <td className={`${td} text-right font-mono`}>{l.agreedPaise !== null ? 'agreed' : l.ratePaise !== null ? `${formatINR(l.ratePaise)}/${CREW_UNIT_SHORT[l.unit]}` : '—'}</td>
            <td className={`${td} text-right font-mono`}>{l.agreedPaise !== null ? '' : q === null ? '—' : qtyWords(q)}</td>
            <td className={`${td} text-right font-mono`}>{l.pending ? 'to price' : formatINR(l.amountPaise ?? 0)}</td>
          </tr>
        );
      })}
    </>
  );
}
