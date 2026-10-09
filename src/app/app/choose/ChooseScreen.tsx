'use client';

/**
 * Meet your studios (v79 "Choose & sign", step 2 of 4). After the call, the
 * studios Meera introduced, each with its visits: a time the studio proposed
 * is confirmed here with one tap, and a final quote, once the studio has
 * measured and issued it, opens from here.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';
import { formatINR } from '@/lib/money';
import { ARCHITECT } from '@/modules/consultation/architect';
import type { ChooseView, ChooseVisit } from '@/modules/portal/choose';
import { answerVisitAction } from './actions';

const TZ = 'Asia/Kolkata';
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const KIND: Record<ChooseVisit['kind'], string> = {
  FIRST_MEETING: 'Studio visit',
  SITE_VISIT: 'Site measurement',
  FOLLOW_UP: 'Follow-up',
};
const expert = ARCHITECT.name.split(' ')[0];

export function Steps({ at }: { at: 1 | 2 | 3 | 4 }) {
  const names = ['Expert call', 'Meet studios', 'Final quote', 'Sign'];
  return (
    <p className="oa-note">
      Step {at} of 4 · {names[at - 1]}
    </p>
  );
}

export function ChooseScreen({ view, sample }: { view: ChooseView | null; sample: boolean }) {
  if (sample || !view) {
    return (
      <Frame>
        <Head back="/app/expert" meta="Choose & sign" />
        <Body>
          <Steps at={2} />
          <h1 className="oa-title">Meet your studios</h1>
          <p className="oa-sub">
            {sample
              ? 'On the live app, the studios you choose to meet after your call appear here, with their visits and their final quotes.'
              : `Sign in with your number to see the studios ${expert} introduced.`}
          </p>
          {sample ? <p className="oa-sample">Test build · no studios are introduced here</p> : null}
        </Body>
        {!sample ? (
          <Foot>
            <Cta href="/sign-in?next=/app/choose">Sign in</Cta>
          </Foot>
        ) : null}
      </Frame>
    );
  }

  const quoted = view.studios.filter((s) => s.finalQuote);
  const first = quoted[0];

  return (
    <Frame>
      <Head back="/app/home" meta="Choose & sign" />
      <Body>
        <Steps at={2} />
        <h1 className="oa-title">Meet your studios</h1>
        {view.studios.length === 0 ? (
          <p className="oa-sub">
            {view.call?.scheduledFor
              ? `After your call on ${when(view.call.scheduledFor)}, ${expert} introduces the studios you want to meet. They appear here, and each one measures your flat and sends a final quote.`
              : `Once you have spoken to ${expert}, the studios you choose to meet appear here.`}
          </p>
        ) : (
          <p className="oa-sub">
            {expert} introduced {view.studios.map((s) => s.name).join(' and ')}. Each one measures your flat and sends a final quote
            here.
          </p>
        )}

        {view.signedWith ? <p className="oa-toast">Signed with {view.signedWith}</p> : null}

        <div className="oa-list">
          {view.studios.map((s) => (
            <section key={s.introductionId} className="oa-meet">
              <div className="top">
                <Link href={`/app/studios/${s.slug}`}>{s.name}</Link>
                <span className="oa-chip small static">
                  {s.finalQuote ? (s.finalQuote.accepted ? 'Signed' : 'Final quote in') : s.visits.some((v) => v.status === 'PROPOSED') ? 'Pick a time' : s.visits.length ? 'Booked' : 'Waiting on the studio'}
                </span>
              </div>
              {s.visits.length === 0 ? (
                <p className="oa-note">{s.name} will propose a time to meet and to measure your flat. You confirm it here.</p>
              ) : (
                s.visits.map((v) => <Visit key={v.id} v={v} />)
              )}
              {s.finalQuote ? (
                <Link href={`/app/choose/quote/${s.finalQuote.id}`} className="oa-share-row" style={{ textDecoration: 'none' }}>
                  <span>
                    <b>{s.finalQuote.accepted ? 'Your signed quote' : 'Final quote has arrived'}</b>
                    <small>{formatINR(s.finalQuote.totalPaise)} before GST</small>
                  </span>
                  <span className="go" aria-hidden>
                    →
                  </span>
                </Link>
              ) : null}
            </section>
          ))}
        </div>

        <div className="oa-card oa-expert-note">
          <span className="oa-avatar" aria-hidden>
            {expert.charAt(0)}
          </span>
          <p>
            <b>{expert}, your expert.</b> Not sure about a studio or a visit? Ask her before you sign. She earns the same whichever
            studio you pick.
          </p>
        </div>
      </Body>
      <Foot>
        {first ? (
          <Cta href={`/app/choose/quote/${first.finalQuote!.id}`}>{first.finalQuote!.accepted ? 'See your signed quote' : 'See the final quote'}</Cta>
        ) : (
          <Cta href="/app/geio?ask=expert" tone="black">
            Ask {expert}
          </Cta>
        )}
      </Foot>
    </Frame>
  );
}

function Visit({ v }: { v: ChooseVisit }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const answer = (yes: boolean) =>
    start(async () => {
      setError(null);
      const r = await answerVisitAction(v.id, yes);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  return (
    <div className="oa-visit">
      <div>
        <b>{KIND[v.kind]}</b>
        <span>
          {when(v.startsAt)}
          {v.location ? ` · ${v.location}` : ''}
        </span>
      </div>
      {v.status === 'PROPOSED' ? (
        <div className="acts">
          <button type="button" className="oa-chip" disabled={pending} onClick={() => answer(true)}>
            Confirm
          </button>
          <button type="button" className="oa-inline-link" disabled={pending} onClick={() => answer(false)}>
            Can&rsquo;t make it
          </button>
        </div>
      ) : (
        <em>{v.status === 'COMPLETED' ? 'Done' : 'Confirmed'}</em>
      )}
      {error ? <p className="oa-note" style={{ color: 'var(--accent-ink)' }}>{error}</p> : null}
    </div>
  );
}
