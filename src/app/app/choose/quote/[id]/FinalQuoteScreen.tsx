'use client';

/**
 * Final quote (v79 "Choose & sign", step 3 of 4): the studio's own quotation
 * after measuring, against their first quote, room by room, with what is
 * locked once they sign.
 *
 * The comparison is before GST on both sides: the studio's quotation carries
 * no GST line, and comparing it with a first quote that did would read as a
 * saving that is not one.
 */

import { useState } from 'react';
import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';
import { formatINR, formatINRCompact } from '@/lib/money';
import { ARCHITECT } from '@/modules/consultation/architect';
import type { FinalQuoteView } from '@/modules/portal/choose';
import { Steps } from '../../ChooseScreen';

const expert = ARCHITECT.name.split(' ')[0];
const SHOWN = 6;

export function FinalQuoteScreen({ q }: { q: FinalQuoteView }) {
  const [all, setAll] = useState(false);
  const diff = q.firstBeforeGstPaise === null ? null : q.totalPaise - q.firstBeforeGstPaise;
  const pct = diff !== null && q.firstBeforeGstPaise ? (diff / q.firstBeforeGstPaise) * 100 : null;
  const rooms = all ? q.rooms : q.rooms.slice(0, SHOWN);

  return (
    <Frame>
      <Head back="/app/choose" meta={`${q.studioName} · after measuring your flat`} />
      <Body>
        <Steps at={3} />
        <h1 className="oa-title">Your final quote</h1>

        <div className="oa-total">
          <p className="oa-note" style={{ margin: 0 }}>
            Total for all {q.lineCount} lines, before GST
          </p>
          <div className="sum">{formatINR(q.totalPaise)}</div>
          {diff === null ? null : Math.abs(diff) < 100 ? (
            <p>Same as your first quote.</p>
          ) : (
            <p>
              {formatINRCompact(Math.abs(diff))} {diff > 0 ? 'more' : 'less'} than your first quote ({diff > 0 ? '+' : '−'}
              {Math.abs(pct ?? 0).toFixed(1)}%), now that they have measured.
            </p>
          )}
        </div>

        <p className="oa-label">Room by room</p>
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {rooms.map((r) => (
            <div key={r.room} className="oa-qrow">
              <b>{r.room}</b>
              <span className="amt">{formatINR(r.amountPaise)}</span>
              <span className="spec">{r.lines.map((l) => l.product).join(', ')}</span>
            </div>
          ))}
        </div>
        {q.rooms.length > SHOWN && !all ? (
          <button type="button" className="oa-inline-link" style={{ alignSelf: 'flex-start' }} onClick={() => setAll(true)}>
            See all {q.rooms.length} rooms
          </button>
        ) : null}

        <div className="oa-bill">
          <div className="row">
            <span>Work, all lines</span>
            <span className="amt">{formatINR(q.workPaise)}</span>
          </div>
          {q.feePaise > 0 ? (
            <div className="row">
              <span>Design and site fee</span>
              <span className="amt">+{formatINR(q.feePaise)}</span>
            </div>
          ) : null}
          {q.discountPaise > 0 ? (
            <div className="row minus">
              <span>Discount on modular work</span>
              <span className="amt">−{formatINR(q.discountPaise)}</span>
            </div>
          ) : null}
          {q.onSpotPaise > 0 ? (
            <div className="row minus">
              <span>Further discount</span>
              <span className="amt">−{formatINR(q.onSpotPaise)}</span>
            </div>
          ) : null}
          <div className="row total">
            <span>Total, before GST</span>
            <span className="amt">{formatINR(q.totalPaise)}</span>
          </div>
        </div>

        <section className="oa-card">
          <p className="oa-label" style={{ marginTop: 0 }}>
            Locked once you sign
          </p>
          <ul className="oa-bullets">
            <li>The price of every line above</li>
            <li>The materials named on each line</li>
            <li>Handover in about {Math.round(q.handoverDays / 7)} weeks from signing</li>
          </ul>
        </section>
      </Body>
      <Foot>
        {q.accepted ? (
          <Cta href="/app/home">Open my project</Cta>
        ) : (
          <>
            <Cta href={`/app/choose/sign/${q.id}`}>Looks right, go to signing</Cta>
            <Cta href="/app/geio?ask=expert" tone="black">
              Ask {expert} to check it first
            </Cta>
          </>
        )}
      </Foot>
    </Frame>
  );
}
