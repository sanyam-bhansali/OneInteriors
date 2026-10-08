'use client';

/**
 * A decision with a deadline (the owner's v1 screens): what it changes if it
 * waits, and every option's price against the quote. On a real project the
 * choice goes to the studio (and can be changed until the due date); on the
 * example it goes nowhere and says so.
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Chevron, Cta, ExampleTag, Foot, Frame } from '@/components/app/ui';
import { chooseOption, useMyProject } from '@/components/app/useMyProject';
import { DECISION, PHOTOS } from '@/modules/app/example-project';
import { dayLabel, optionPrice, pickDecision } from '@/modules/app/project-view';
import { ARCHITECT } from '@/modules/consultation/architect';

const expert = ARCHITECT.name.replace(/^Ar\.\s*/, '').split(' ')[0];

interface DecisionData {
  id: string | null;
  title: string;
  why: string;
  due: string;
  closed: boolean;
  chosen: number | null;
  options: { name: string; note: string; price: string; swatch: string | null }[];
}

const EXAMPLE_DECISION: DecisionData = {
  id: null,
  title: DECISION.title,
  why: DECISION.why,
  due: DECISION.due,
  closed: false,
  chosen: null,
  options: DECISION.options.map((o) => ({ ...o })),
};

export default function AppDecisionPage() {
  return (
    <Suspense fallback={<Frame>{null}</Frame>}>
      <AppDecision />
    </Suspense>
  );
}

function AppDecision() {
  const router = useRouter();
  const id = useSearchParams().get('id');
  const mine = useMyProject();
  const [pick, setPick] = useState<number | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (mine.state === 'loading') return <Frame>{null}</Frame>;
  const real = mine.state === 'real';
  const found = real ? pickDecision(mine.project.decisions, id) : null;

  if (real && !found) {
    return (
      <Frame>
        <main className="oa-body" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
          <h1 className="oa-title">Nothing to decide right now.</h1>
          <p className="oa-sub">When the studio needs a choice from you, it appears here with its deadline, and on your phone.</p>
        </main>
        <Foot>
          <Cta href="/app/home">Back to your home</Cta>
        </Foot>
      </Frame>
    );
  }

  const d: DecisionData = found
    ? {
        id: found.id,
        title: found.title,
        why: found.why,
        due: dayLabel(found.dueOn),
        closed: found.state === 'overdue' || found.daysLeft < 0,
        chosen: found.chosenIndex,
        options: found.options.map((o) => ({ name: o.name, note: o.note, price: optionPrice(o), swatch: o.swatch })),
      }
    : EXAMPLE_DECISION;
  const selected = pick ?? d.chosen ?? 0;
  const chosen = d.options[selected]!;
  const studio = real ? mine.project.studio : 'the studio';

  const confirm = async () => {
    if (!d.id) {
      setStatus({ ok: true, text: `Example · in your project, ${chosen.name.toLowerCase()} goes to the studio with the date` });
      return;
    }
    setBusy(true);
    const err = await chooseOption(d.id, selected);
    setBusy(false);
    if (err) return setStatus({ ok: false, text: err });
    setStatus({ ok: true, text: `${chosen.name} confirmed. ${studio} is told.` });
    mine.reload();
  };

  return (
    <Frame>
      {real ? null : <ExampleTag />}
      <section className="oa-decision-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTOS.kitchen} alt="" />
        <button type="button" className="oa-round-back" aria-label="Back" onClick={() => router.push('/app/home')}>
          <Chevron />
        </button>
        <span className="oa-meta" style={{ left: 22, bottom: 16, color: '#fff' }}>
          {d.closed ? `Closed ${d.due}` : `Your decision, due ${d.due}`}
        </span>
      </section>
      <main className="oa-body">
        <h1 className="oa-title">{d.title}</h1>
        <p className="oa-sub" style={{ margin: 0 }}>
          {d.why}
        </p>
        <div role="radiogroup" aria-label="Options" style={{ borderTop: '1px solid var(--line)' }}>
          {d.options.map((o, i) => (
            <button
              key={o.name}
              type="button"
              role="radio"
              aria-checked={i === selected}
              className="oa-option"
              disabled={d.closed}
              onClick={() => {
                setPick(i);
                setStatus(null);
              }}
            >
              <span className="oa-swatch" style={{ background: o.swatch ?? 'var(--surface)' }} aria-hidden />
              <span className="min-w-0 flex-1">
                <b style={{ display: 'block', fontSize: 18, fontWeight: 600 }}>{o.name}</b>
                <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{o.note}</span>
              </span>
              <span style={{ font: '500 13px var(--mono)', color: o.price === 'In quote' ? 'var(--ok)' : 'var(--ink)' }}>{o.price}</span>
            </button>
          ))}
        </div>
        <p className="oa-note" style={{ margin: 0 }}>
          Not sure?{' '}
          <Link href="/app/geio?from=decision&ask=expert" style={{ color: 'var(--accent-ink)', textDecoration: 'underline' }}>
            Ask {expert}
          </Link>{' '}
          before {d.due}. She earns nothing from any option.
        </p>
        {status ? (
          <p className={status.ok ? 'oa-toast' : 'oa-note'} role="status" style={status.ok ? undefined : { color: 'var(--accent-ink)' }}>
            {status.text}
          </p>
        ) : null}
      </main>
      <Foot>
        <Cta onClick={confirm} disabled={busy || d.closed}>
          {d.closed ? 'This decision has closed' : `Confirm ${chosen.name.charAt(0).toLowerCase() + chosen.name.slice(1)}`}
        </Cta>
      </Foot>
    </Frame>
  );
}
