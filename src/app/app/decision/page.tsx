'use client';

/** A decision with a deadline (the owner's v1 screens): what it changes if it waits, and every option's price against the quote. */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Chevron, Cta, ExampleTag, Foot, Frame } from '@/components/app/ui';
import { DECISION, photo } from '@/modules/app/example-project';
import { ARCHITECT } from '@/modules/consultation/architect';

const expert = ARCHITECT.name.replace(/^Ar\.\s*/, '').split(' ')[0];

export default function AppDecision() {
  const router = useRouter();
  const [pick, setPick] = useState(0);
  const [done, setDone] = useState(false);
  const chosen = DECISION.options[pick]!;

  return (
    <Frame>
      <ExampleTag />
      <section className="oa-decision-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(30)} alt="" />
        <button type="button" className="oa-round-back" aria-label="Back" onClick={() => router.push('/app/home')}>
          <Chevron />
        </button>
        <span className="oa-meta" style={{ left: 22, bottom: 16, color: '#fff' }}>
          Your decision, due {DECISION.due}
        </span>
      </section>
      <main className="oa-body">
        <h1 className="oa-title">{DECISION.title}</h1>
        <p className="oa-sub" style={{ margin: 0 }}>
          {DECISION.why}
        </p>
        <div role="radiogroup" aria-label="Finish" style={{ borderTop: '1px solid var(--line)' }}>
          {DECISION.options.map((o, i) => (
            <button
              key={o.name}
              type="button"
              role="radio"
              aria-checked={i === pick}
              className="oa-option"
              onClick={() => {
                setPick(i);
                setDone(false);
              }}
            >
              <span className="oa-swatch" style={{ background: o.swatch }} aria-hidden />
              <span className="min-w-0 flex-1">
                <b style={{ display: 'block', fontSize: 18, fontWeight: 600 }}>{o.name}</b>
                <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{o.note}</span>
              </span>
              <span style={{ font: '500 13px var(--mono)', color: i === 0 ? 'var(--ok)' : 'var(--ink)' }}>{o.price}</span>
            </button>
          ))}
        </div>
        <p className="oa-note" style={{ margin: 0 }}>
          Not sure?{' '}
          <Link href="/app/geio?from=decision&ask=expert" style={{ color: 'var(--accent-ink)', textDecoration: 'underline' }}>
            Ask {expert}
          </Link>{' '}
          before Friday. She earns nothing from any finish.
        </p>
        {done ? (
          <p className="oa-sample" role="status">
            Example · in your project this goes to the studio with the date
          </p>
        ) : null}
      </main>
      <Foot>
        <Cta onClick={() => setDone(true)}>Confirm {chosen.name.charAt(0).toLowerCase() + chosen.name.slice(1)}</Cta>
      </Foot>
    </Frame>
  );
}
