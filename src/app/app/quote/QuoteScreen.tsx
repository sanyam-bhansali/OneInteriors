'use client';

/**
 * The quote (v79 design + the trust fixes, 9 Oct 2026). One studio at a time,
 * labelled for what it is — a first quote from the studio's own rate card —
 * with every room opening to its lines, each line's "usual in Pune" range in
 * rupees, the total written out step by step, and what is and is not in it.
 *
 * The range is only what the listed studios' filed rates come to for the same
 * line on this home; a studio's per-unit rate is never shown. How far the
 * first quote can move is the quote's own band, not a promise.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';
import { useJourney } from '@/components/app/useJourney';
import { formatINR, formatINRCompact } from '@/lib/money';
import { useAppData } from '@/components/app/useAppData';
import { filedRatesFor } from '@/data/filed-rates';
import { listedStudios, quotesForStudios } from '@/modules/app/journey';
import { puneRanges, type LineRange } from '@/modules/app/pune-range';
import { CATALOGUE, GST_BPS, MODULAR_DISCOUNT_BPS, PROFESSIONAL_FEE_BPS, ROOM_LABELS } from '@/modules/quotation/catalogue';
import type { FirstQuote, QuoteLine } from '@/modules/quotation/first-quote';
import type { AppData } from '../data';

const VALID_DAYS = 30;

export function QuoteScreen({ data }: { data: AppData }) {
  const { brief, quotes } = useJourney(data);
  const [pick, setPick] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const ranges = useMemo(() => {
    if (!brief?.completedAt) return new Map<string, LineRange>();
    const all = quotesForStudios(brief, listedStudios(data), data.rates, filedRatesFor);
    return puneRanges(all.map((q) => q.quote));
  }, [brief, data]);

  if (!brief) return <Frame>{null}</Frame>;

  if (quotes.length === 0) {
    return (
      <Frame>
        <Head back="/app/matches" />
        <Body>
          <h1 className="oa-title">Your quotes come from your answers.</h1>
          <p className="oa-sub">Finish the seven questions and the three studios that fit price the same lines for you.</p>
        </Body>
        <Foot>
          <Cta href="/app/q/1">Start the brief</Cta>
        </Foot>
      </Frame>
    );
  }

  const q = quotes[Math.min(pick, quotes.length - 1)]!;
  const rooms = q.quote.rooms.filter((r) => r.lines.length > 0);
  const firstRoom = open ?? rooms[0]?.label ?? null;
  const validTill = new Date(new Date(brief.completedAt ?? Date.now()).getTime() + VALID_DAYS * 864e5).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <Frame>
      <Head back="/app/matches" meta={`First quotes · ${quotes.length} studio${quotes.length === 1 ? '' : 's'}`} />
      <Body>
        <h1 className="oa-title">A quote you can actually read.</h1>
        <p className="oa-note">
          <b style={{ color: 'var(--ink)' }}>First quote, from each studio&rsquo;s own rate card.</b> The final price comes after they
          measure your flat; until then this one can move by ±{Math.round(q.quote.variancePct * 100)}%. Valid till {validTill}.
        </p>
        {!data.ratesReal ? <p className="oa-sample">Pre-launch rates · not yet the studio&rsquo;s own</p> : null}

        <div className="oa-chips" role="group" aria-label="Studio">
          {quotes.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              className="oa-chip"
              aria-pressed={i === pick}
              onClick={() => {
                setPick(i);
                setOpen(null);
              }}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--line)' }}>
          {rooms.map((r) => {
            const isOpen = firstRoom === r.label;
            return (
              <div key={r.room} className={`oa-qroom${isOpen ? ' open' : ''}`}>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : r.label)}>
                  <b>{r.label}</b>
                  <span className="amt">{formatINR(r.subtotalPaise)}</span>
                  <span className="spec">
                    {r.lines.length} line{r.lines.length === 1 ? '' : 's'} · {r.lines[0]!.spec}
                  </span>
                  <span className="how">{isOpen ? 'Hide how we priced this' : 'How we priced this'}</span>
                </button>
                {isOpen ? (
                  <div className="lines">
                    {r.lines.map((l) => (
                      <Line key={l.code} line={l} range={ranges.get(l.code)} />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="oa-label">How the total is reached</p>
        <Bill quote={q.quote} />
        <p className="oa-note">
          Priced from {q.name}&rsquo;s own rate card. One Interiors adds nothing on top. Measured on site, the total lands between{' '}
          {formatINRCompact(q.quote.lowPaise)} and {formatINRCompact(q.quote.highPaise)}.
        </p>

        <Included quote={q.quote} renovation={brief.scope === 'RENOVATION'} />

        <Link href="/app/geio?from=quote" className="oa-share-row" style={{ textDecoration: 'none' }}>
          <span>
            <b>Not sure what a line means?</b>
            <small>Ask GEIO, in plain words</small>
          </span>
          <span className="go" aria-hidden>
            →
          </span>
        </Link>
      </Body>
      <Foot>
        <Cta href="/app/compare" tone="black">
          {quotes.length > 1 ? `Compare all ${quotes.length}, row by row` : 'See it in plain words'}
        </Cta>
      </Foot>
    </Frame>
  );
}

function Line({ line, range }: { line: QuoteLine; range?: LineRange }) {
  // The bar's ends sit a little outside the range so the dot never touches the edge.
  const pad = range ? Math.max((range.highPaise - range.lowPaise) * 0.2, range.highPaise * 0.04) : 0;
  const min = range ? range.lowPaise - pad : 0;
  const max = range ? range.highPaise + pad : 1;
  const at = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  return (
    <div className="oa-qline">
      <div className="top">
        <b>{line.label}</b>
        <span>{formatINR(line.amountPaise)}</span>
      </div>
      <span className="m">
        {line.size} · {line.spec}
      </span>
      {line.addedFor ? <span className="m">{line.addedFor}</span> : null}
      {range ? (
        <>
          <div className="oa-range" aria-hidden>
            <span className="track" />
            <span className="band" style={{ left: at(range.lowPaise), width: `calc(${at(range.highPaise)} - ${at(range.lowPaise)})` }} />
            <span className="dot" style={{ left: at(line.amountPaise) }} />
          </div>
          <span className="m">
            Usual in Pune {formatINR(range.lowPaise)}–{formatINR(range.highPaise)}, from {range.studios} studios&rsquo; rate cards
          </span>
        </>
      ) : null}
    </div>
  );
}

function Bill({ quote: q }: { quote: FirstQuote }) {
  const rows: [string, number, 'plus' | 'minus' | null][] = [
    [`All ${q.lines.length} lines`, q.modularPaise + q.nonModularPaise, null],
    [`Modular discount, ${MODULAR_DISCOUNT_BPS / 100}%`, q.modularDiscountPaise, 'minus'],
    [`Design and site fee, ${PROFESSIONAL_FEE_BPS / 100}%`, q.professionalFeePaise, 'plus'],
    ...(q.curatedDiscountPaise
      ? [[`One Interiors discount${q.curatedDiscountPct ? `, ${q.curatedDiscountPct}%` : ''}`, q.curatedDiscountPaise, 'minus'] as [string, number, 'minus']]
      : []),
    [`GST, ${GST_BPS / 100}%`, q.gstPaise, 'plus'],
  ];
  return (
    <div className="oa-bill">
      {rows
        .filter(([, v, sign]) => sign === null || v > 0)
        .map(([label, v, sign]) => (
          <div key={label} className={`row${sign === 'minus' ? ' minus' : ''}`}>
            <span>{label}</span>
            <span className="amt">
              {sign === 'minus' ? '−' : sign === 'plus' ? '+' : ''}
              {formatINR(v)}
            </span>
          </div>
        ))}
      <div className="row total">
        <span>Total</span>
        <span className="amt">{formatINR(q.totalPaise)}</span>
      </div>
    </div>
  );
}

function Included({ quote: q, renovation }: { quote: FirstQuote; renovation: boolean }) {
  const missing = q.notPriced
    .map((code) => CATALOGUE.find((i) => i.code === code))
    .filter((i): i is (typeof CATALOGUE)[number] => Boolean(i))
    .map((i) => `${i.label}, ${ROOM_LABELS[i.room].toLowerCase()} (no rate filed)`);
  const out = [
    ...missing,
    'Appliances: hob, chimney, fridge',
    'Loose furniture, curtains and light fittings',
    ...(renovation ? [] : ['Civil work: tiling, plumbing, breaking walls']),
    'Society deposits and permissions',
  ];
  return (
    <div className="oa-incl">
      <div className="yes">
        <p className="oa-label">Included</p>
        <ul>
          <li>Every line above, made and fitted</li>
          <li>Labour and installation</li>
          <li>Design and site supervision</li>
          <li>GST</li>
        </ul>
      </div>
      <div className="no">
        <p className="oa-label">Not included</p>
        <ul>
          {out.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The screen once the studio data is here — usually already, since the quiz fetches it early. */
export function Quote() {
  const data = useAppData();
  return data ? <QuoteScreen data={data} /> : <Frame>{null}</Frame>;
}
