'use client';

import Link from 'next/link';
import { formatINR } from '@/lib/money';
import { formatQty, areaMilli, type QuoteTotals } from '@/modules/studio-quote/pricing';
import type { RevisionSummary, RoomTotal } from '@/modules/studio-quote/revision';
import type { QuoteRow } from '@/modules/studio-quote/quotes';
import type { PricedLine } from './QuoteLines';

/**
 * The money, and where it is going.
 *
 * Sticky beside the lines, because the total is the number being watched.
 * Everything here is derived from the lines on screen rather than from the
 * database, so it moves with the typing — a figure that only catches up after
 * a save is a figure nobody trusts mid-conversation.
 */
export function TotalsPanel({
  quote,
  totals,
  rooms,
}: {
  quote: QuoteRow;
  totals: QuoteTotals;
  rooms: RoomTotal[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="s-card overflow-hidden">
        <div className="bg-[var(--s-surface-2)] px-4 py-2.5">
          <h2 className="m-0 text-[14.5px] font-semibold">The total</h2>
        </div>

        <dl className="m-0 flex flex-col gap-2 px-4 py-4 text-[13.5px]">
          <Row label="Modular" value={totals.modularPaise} />
          <Row label="On-site" value={totals.onsitePaise} />
          <Row label={`Professional fee · ${quote.feeBps / 100}%`} value={totals.feePaise} />
          <div className="my-1 border-t border-[var(--s-rule-soft)]" />
          <Row label="Sub-total" value={totals.subTotalPaise} bold />
          {totals.discountPaise > 0 ? (
            <Row
              label={`Discount · ${quote.discountBps / 100}% on modular`}
              value={-totals.discountPaise}
            />
          ) : null}
          {totals.onSpotPaise > 0 ? <Row label="On the spot" value={-totals.onSpotPaise} /> : null}
        </dl>

        <div className="flex items-baseline justify-between gap-3 border-t border-[var(--s-rule)] bg-[var(--s-accent-wash)] px-4 py-3">
          <span className="text-[14px] font-semibold">What the client pays</span>
          <span className="s-num text-[18px] font-semibold">{formatINR(totals.totalPaise)}</span>
        </div>
      </div>

      {rooms.length > 1 ? <RoomBreakdown rooms={rooms} /> : null}

      {totals.stages.length > 0 ? (
        <div className="s-card overflow-hidden">
          <div className="bg-[var(--s-surface-2)] px-4 py-2.5">
            <h2 className="m-0 text-[14.5px] font-semibold">Payment schedule</h2>
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {totals.stages.map((s) => (
              <li
                key={s.label}
                className="flex items-baseline justify-between gap-3 border-b border-[var(--s-rule-soft)] px-4 py-2.5 last:border-b-0"
              >
                <span className="text-[13.5px]">{s.label}</span>
                <span className="s-num text-[13.5px] font-medium">{formatINR(s.amountPaise)}</span>
              </li>
            ))}
          </ul>
          <p className="m-0 border-t border-[var(--s-rule-soft)] px-4 py-2.5 text-[12px] leading-snug text-[var(--s-ink-3)]">
            These add up to the total exactly. Set the fee, discount and advance in{' '}
            <Link href="/studio/settings" className="text-[var(--s-accent)]">
              Settings
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Where the money is going, by room.
 *
 * Bars rather than a pie: the question is "what is the kitchen costing me"
 * against a known total, which a length answers and an angle does not. It
 * exists for one conversation — the client wants the number down and nobody
 * can say where from — and for that, order matters more than precision.
 */
function RoomBreakdown({ rooms }: { rooms: RoomTotal[] }) {
  const top = rooms[0]!.paise;

  return (
    <div className="s-card overflow-hidden">
      <div className="bg-[var(--s-surface-2)] px-4 py-2.5">
        <h2 className="m-0 text-[14.5px] font-semibold">Where it is going</h2>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-4">
        {rooms.map((room) => (
          <li key={room.room}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px]">{room.room}</span>
              <span className="s-num flex-none text-[12.5px] text-[var(--s-ink-2)]">
                {formatINR(room.paise)}
                <span className="ml-1.5 text-[var(--s-ink-3)]">
                  {(room.shareBps / 100).toFixed(0)}%
                </span>
              </span>
            </div>
            <div className="h-[5px] overflow-hidden rounded-full bg-[var(--s-surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--s-accent)]"
                /* Against the biggest room, not against the total. Shares of a
                   forty-line quotation are all small, and a chart where every
                   bar is a sliver compares nothing. */
                style={{ width: `${Math.max(2, Math.round((room.paise / top) * 100))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`m-0 ${bold ? 'font-semibold' : 'text-[var(--s-ink-2)]'}`}>{label}</dt>
      <dd className={`s-num m-0 ${bold ? 'font-semibold' : ''}`}>
        {value < 0 ? `− ${formatINR(Math.abs(value))}` : formatINR(value)}
      </dd>
    </div>
  );
}

/**
 * The document, as the client will read it.
 *
 * ## Why this is here and not only on the print page
 *
 * Because "what does this look like to them" is a question asked while
 * editing, not after. A preview two pages away is a preview nobody opens until
 * the end, which is when a studio discovers that a room they named "BR2" is
 * printed on a document going to a homeowner.
 *
 * It is a preview and says so: the printed copy carries the full terms, the
 * payment schedule and the signature block. Reproducing those here would be a
 * second copy of the document to keep in step with the first.
 */
export function DocumentPreview({
  quote,
  lines,
  rooms,
  totals,
  branding,
  showMark,
  markText,
  logoUrl,
}: {
  quote: QuoteRow;
  lines: PricedLine[];
  rooms: string[];
  totals: QuoteTotals;
  branding: {
    legalName: string;
    addressLine: string | null;
    city: string;
    pincode: string | null;
    gstin: string | null;
    phone: string | null;
    email: string | null;
    accentHex: string;
  } | null;
  showMark: boolean;
  markText: string;
  logoUrl: string | null;
}) {
  if (!branding) {
    return (
      <div className="s-card p-5">
        <p className="m-0 mb-1.5 text-[14.5px] font-semibold">
          Your studio details are not filled in yet.
        </p>
        <p className="m-0 max-w-[62ch] text-[14px] leading-relaxed text-[var(--s-ink-2)]">
          A quotation carries your registered name, your address and your GSTIN — a document
          without them is one a client cannot act on.{' '}
          <Link href="/studio/settings" className="font-medium text-[var(--s-accent)]">
            Add them in Settings
          </Link>{' '}
          and this preview fills in.
        </p>
      </div>
    );
  }

  /* Validated at the point of use. `accentHex` is studio-supplied and this is
     interpolated into a style, where React does not escape. A rejected value
     falls back to the app accent rather than to nothing. */
  const accent = /^#[0-9a-fA-F]{6}$/.test(branding.accentHex) ? branding.accentHex : '#a44f2e';

  return (
    <article className="s-card overflow-hidden bg-white p-0 text-[#1c1b19]">
      <header
        className="flex flex-wrap items-start justify-between gap-4 border-b-[3px] px-7 py-6"
        style={{ borderColor: accent }}
      >
        <div className="min-w-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="mb-2 max-h-[46px] max-w-[190px] object-contain" />
          ) : null}
          <p className="m-0 text-[17px] font-semibold">{branding.legalName}</p>
          <p className="m-0 mt-0.5 text-[12.5px] leading-relaxed text-[#56524b]">
            {[branding.addressLine, branding.city, branding.pincode].filter(Boolean).join(', ')}
          </p>
          <p className="m-0 text-[12.5px] text-[#56524b]">
            {[branding.phone, branding.email].filter(Boolean).join(' · ')}
          </p>
          {branding.gstin ? (
            <p className="s-num m-0 mt-0.5 text-[12px] text-[#6a655c]">GSTIN {branding.gstin}</p>
          ) : null}
        </div>

        <div className="text-right">
          <p className="m-0 text-[12px] uppercase tracking-[.16em] text-[#6a655c]">Quotation</p>
          <p className="s-num m-0 text-[16px] font-semibold">{quote.number}</p>
          <p className="m-0 mt-1 text-[12.5px] text-[#56524b]">
            {new Date(quote.updatedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </header>

      <div className="border-b border-[#e5e1d9] px-7 py-4">
        <p className="m-0 text-[12px] uppercase tracking-[.16em] text-[#6a655c]">For</p>
        <p className="m-0 text-[15px] font-semibold">{quote.clientName}</p>
        <p className="m-0 text-[13px] text-[#56524b]">
          {[quote.society, quote.locality, quote.config].filter(Boolean).join(' · ')}
        </p>
      </div>

      {lines.length === 0 ? (
        <p className="m-0 px-7 py-8 text-[13.5px] italic text-[#6a655c]">
          Nothing on this quotation yet.
        </p>
      ) : (
        rooms.map((room) => {
          const inRoom = lines.filter((l) => l.room === room);
          if (inRoom.length === 0) return null;

          return (
            <section key={room} className="px-7 py-4">
              <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-[#e5e1d9] pb-1.5">
                <h3 className="m-0 text-[13.5px] font-semibold uppercase tracking-[.1em]">
                  {room}
                </h3>
                <span className="s-num text-[13px] font-medium">
                  {formatINR(inRoom.reduce((a, l) => a + l.amountPaise, 0))}
                </span>
              </div>

              <table className="w-full border-collapse text-[12.5px]">
                <tbody>
                  {inRoom.map((line) => (
                    <tr key={line.key} className="align-top">
                      <td className="py-1.5 pr-3">
                        <span className="text-[13px]">{line.product}</span>
                        {line.details ? (
                          <span className="block text-[11.5px] leading-snug text-[#6a655c]">
                            {line.details}
                          </span>
                        ) : null}
                      </td>
                      <td className="s-num whitespace-nowrap py-1.5 pr-3 text-right text-[#56524b]">
                        {measure(line)}
                      </td>
                      <td className="s-num whitespace-nowrap py-1.5 text-right font-medium">
                        {line.amountPaise > 0 ? formatINR(line.amountPaise) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })
      )}

      <div className="border-t border-[#e5e1d9] px-7 py-5">
        <dl className="m-0 ml-auto flex max-w-[22rem] flex-col gap-1.5 text-[13px]">
          <DocRow label="Modular" value={totals.modularPaise} />
          <DocRow label="On-site" value={totals.onsitePaise} />
          <DocRow label={`Professional fee · ${quote.feeBps / 100}%`} value={totals.feePaise} />
          {totals.discountPaise > 0 ? (
            <DocRow label="Discount" value={-totals.discountPaise} />
          ) : null}
          {totals.onSpotPaise > 0 ? <DocRow label="On the spot" value={-totals.onSpotPaise} /> : null}
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 pt-2" style={{ borderColor: accent }}>
            <dt className="m-0 text-[14px] font-semibold">Total</dt>
            <dd className="s-num m-0 text-[16px] font-semibold">{formatINR(totals.totalPaise)}</dd>
          </div>
        </dl>
      </div>

      <footer className="border-t border-[#e5e1d9] px-7 py-4">
        <p className="m-0 text-[11.5px] leading-relaxed text-[#6a655c]">
          A preview. The printed copy carries your terms, the payment schedule and the signature
          block.
        </p>
        {/* Below the GSTIN, never in the terms and never beside their name. */}
        {showMark ? (
          <p className="m-0 mt-1 text-[11px] italic text-[#8a8378]">{markText}</p>
        ) : null}
      </footer>
    </article>
  );
}

/** What the client sees in the size column: the measurement, not the arithmetic. */
function measure(line: PricedLine): string {
  if (line.unit === 'AREA') {
    if (!line.widthMm || !line.heightMm) return '—';
    return `${line.widthMm} × ${line.heightMm} mm · ${formatQty(areaMilli(line.widthMm, line.heightMm))} sq ft`;
  }
  if (line.qtyMilli == null) return '—';
  const qty = formatQty(line.qtyMilli);
  if (line.unit === 'UNIT') return `${qty} ${Number(qty) === 1 ? 'no.' : 'nos.'}`;
  if (line.unit === 'RFT') return `${qty} rft`;
  return `${qty} sq ft`;
}

function DocRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="m-0 text-[#56524b]">{label}</dt>
      <dd className="s-num m-0">
        {value < 0 ? `− ${formatINR(Math.abs(value))}` : formatINR(value)}
      </dd>
    </div>
  );
}

/**
 * What moved since the client was sent this.
 *
 * ## Why the headline is the count and not the money
 *
 * Two changes that cancel out leave the total where it was, and a screen
 * reading "no change" while the client can see their wardrobe has gone is
 * worse than no screen at all. So the count leads and the figure follows.
 */
export function ChangesPanel({
  summary,
  issuedOn,
}: {
  summary: RevisionSummary;
  issuedOn: Date | null;
}) {
  const sent = issuedOn
    ? new Date(issuedOn).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const moved = summary.changes.filter((c) => c.kind !== 'UNCHANGED');

  return (
    <div className="flex flex-col gap-4">
      <div className="s-card p-5">
        <h2 className="m-0 mb-1 text-[15px] font-semibold">
          {summary.identical
            ? 'Nothing has changed since you sent it.'
            : `${moved.length} ${moved.length === 1 ? 'line has' : 'lines have'} changed since you sent it.`}
        </h2>
        <p className="m-0 max-w-[64ch] text-[13.5px] leading-relaxed text-[var(--s-ink-2)]">
          Compared against the copy the client received{sent ? ` on ${sent}` : ''} — not against
          your last save. Drafts you revised before sending are not changes as far as they are
          concerned.
        </p>

        {summary.identical ? null : (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
            {summary.addedCount > 0 ? <Pill kind="ADDED">{summary.addedCount} added</Pill> : null}
            {summary.removedCount > 0 ? (
              <Pill kind="REMOVED">{summary.removedCount} removed</Pill>
            ) : null}
            {summary.repricedCount > 0 ? (
              <Pill kind="REPRICED">{summary.repricedCount} repriced</Pill>
            ) : null}
            <span className="s-num font-semibold">
              {summary.deltaPaise === 0
                ? 'Total unchanged'
                : summary.deltaPaise > 0
                  ? `${formatINR(summary.deltaPaise)} more`
                  : `${formatINR(Math.abs(summary.deltaPaise))} less`}
            </span>
          </div>
        )}
      </div>

      {moved.length > 0 ? (
        <ul className="s-card m-0 flex list-none flex-col p-0">
          {moved.map((change) => (
            <li
              key={`${change.room}|${change.product}|${change.kind}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--s-rule-soft)] px-4 py-3 last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{change.product}</span>
                <span className="s-label">{change.room}</span>
              </span>

              <Pill kind={change.kind}>
                {change.kind === 'ADDED' ? 'New' : change.kind === 'REMOVED' ? 'Removed' : 'Repriced'}
              </Pill>

              <span className="s-num whitespace-nowrap text-[13.5px]">
                {change.kind === 'REPRICED' ? (
                  <>
                    <span className="text-[var(--s-ink-3)] line-through">
                      {formatINR(change.wasPaise)}
                    </span>{' '}
                    {formatINR(change.nowPaise)}
                  </>
                ) : change.kind === 'ADDED' ? (
                  formatINR(change.nowPaise)
                ) : (
                  <span className="text-[var(--s-ink-3)] line-through">
                    {formatINR(change.wasPaise)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Pill({ kind, children }: { kind: string; children: React.ReactNode }) {
  const tone =
    kind === 'ADDED'
      ? '!bg-[var(--s-good-wash,#e5eee1)] !text-[var(--s-good,#4a6a4f)]'
      : kind === 'REMOVED'
        ? '!bg-[var(--s-warn-wash,#f5e9cf)] !text-[var(--s-warn,#8d6412)]'
        : '!bg-[var(--s-accent-wash)] !text-[var(--s-accent-deep)]';

  return <span className={`s-tag flex-none ${tone}`}>{children}</span>;
}
