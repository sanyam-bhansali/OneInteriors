'use client';

/**
 * The quote (the owner's v1 screens): one studio at a time, room by room, a
 * full rupee figure against each and the material underneath it in mono.
 * The same lines for all three, so the tabs are a fair comparison.
 */

import { useState } from 'react';
import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';
import { useJourney } from '@/components/app/useJourney';
import { formatINR, formatINRCompact } from '@/lib/money';
import type { AppData } from '../data';

const SHOWN = 4;

export function QuoteScreen({ data }: { data: AppData }) {
  const { brief, quotes } = useJourney(data);
  const [pick, setPick] = useState(0);

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
  const shown = rooms.slice(0, SHOWN);
  const rest = rooms.slice(SHOWN);
  const restLines = rest.reduce((n, r) => n + r.lines.length, 0);
  const restPaise = rest.reduce((n, r) => n + r.subtotalPaise, 0);

  return (
    <Frame>
      <Head back="/app/matches" meta={`Same lines for all ${quotes.length}`} />
      <Body>
        <h1 className="oa-title">A quote you can actually read.</h1>
        {!data.ratesReal ? (
          <p className="oa-sample">Pre-launch rates · not yet the studio&rsquo;s own</p>
        ) : null}

        <div className="oa-chips" role="group" aria-label="Studio">
          {quotes.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              className="oa-chip"
              aria-pressed={i === pick}
              onClick={() => setPick(i)}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--line)' }}>
          {shown.map((r) => {
            const first = r.lines[0]!;
            return (
              <div key={r.room} className="oa-qrow">
                <b>{r.label}</b>
                <span className="amt">{formatINR(r.subtotalPaise)}</span>
                <span className="spec">{[first.size, first.spec].filter(Boolean).join(', ')}</span>
              </div>
            );
          })}
          {rest.length > 0 ? (
            <div className="oa-qrow">
              <b style={{ fontWeight: 500, color: 'var(--ink-2)' }}>
                {restLines} more line{restLines === 1 ? '' : 's'}
              </b>
              <span className="amt">{formatINR(restPaise)}</span>
              <span className="spec">{rest.map((r) => r.label).join(', ')}</span>
            </div>
          ) : null}
        </div>

        <div className="oa-total">
          <div className="sum">{formatINRCompact(q.quote.totalPaise)}</div>
          <p>
            Total for all {q.quote.lines.length} lines, with GST. Measured on site it can move ±{Math.round(q.quote.variancePct * 100)}%.
          </p>
        </div>
      </Body>
      <Foot>
        <Cta href="/app/compare" tone="black">
          {quotes.length > 1 ? `Compare all ${quotes.length}, row by row` : 'See it in plain words'}
        </Cta>
      </Foot>
    </Frame>
  );
}
