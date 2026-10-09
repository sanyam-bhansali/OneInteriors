'use client';

/**
 * Expert call (v79 design): who the expert is and who pays her, then a day
 * and a time, booked in one tap with the number they verified at "quotes
 * ready" (trust fix 1). The booking goes through the same service as the
 * website's /expert form, so there is one booking path. A test build books
 * nothing and says so.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';
import { useAppData } from '@/components/app/useAppData';
import { useJourney } from '@/components/app/useJourney';
import type { AppData } from '../data';
import { bookExpertCallAction } from './actions';

const TZ = 'Asia/Kolkata';
const DAYS_SHOWN = 4;
const TIMES_SHOWN = 6;

/** The confetti: where each piece lands and its colour, from the design file. */
const BURST: [number, number, string][] = [
  [70, 0, '#ba5329'],
  [81, 34, '#e07a4e'],
  [75, 75, '#f2c98a'],
  [27, 65, '#f1f0ec'],
  [0, 88, '#ba5329'],
  [-41, 98, '#e07a4e'],
  [-49, 49, '#f2c98a'],
  [-81, 34, '#f1f0ec'],
  [-106, 0, '#ba5329'],
  [-65, -27, '#e07a4e'],
  [-62, -62, '#f2c98a'],
  [-41, -98, '#f1f0ec'],
  [0, -70, '#ba5329'],
  [34, -81, '#e07a4e'],
  [75, -75, '#f2c98a'],
  [65, -27, '#f1f0ec'],
];

const NEXT = [
  'Talk through the {n} quotes with {expert}',
  'Meet the studios you like, at their office or your flat',
  'See the final quote, sign, and watch your home come together here',
];

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('en-IN', { timeZone: TZ, ...o });
const timeOf = (iso: string) => fmt(iso, { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

/** Up to `n` times spread across the day, so the grid is a choice and not a list. */
function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]!);
}

export function ExpertScreen({ slots, sample, expert }: { slots: string[]; sample: boolean; expert: string }) {
  const router = useRouter();
  const data = useAppData();
  const studioIds = useStudioIds(data);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const days = useMemo(() => {
    const by = new Map<string, string[]>();
    for (const s of slots) by.set(dayKey(s), [...(by.get(dayKey(s)) ?? []), s]);
    return [...by.values()].slice(0, DAYS_SHOWN).map((list) => ({ first: list[0]!, times: spread(list, TIMES_SHOWN) }));
  }, [slots]);
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  const first = expert.replace(/^Ar\.\s*/, '').split(' ')[0] ?? expert;

  const label = slot ? `${fmt(slot, { weekday: 'short', day: 'numeric', month: 'short' })}, ${timeOf(slot)}` : null;

  const book = async () => {
    if (!slot) return;
    if (sample) return setBooked(true);
    setError(null);
    setBusy(true);
    const r = await bookExpertCallAction({ startsAt: slot, studioIds });
    setBusy(false);
    if (!r.ok) {
      if (r.signIn) return router.push('/app/verify');
      return setError(r.error);
    }
    setPhone(r.phone);
    setBooked(true);
  };

  if (booked && slot) {
    const when = `${fmt(slot, { weekday: 'long', day: 'numeric', month: 'long' })}, ${timeOf(slot)}`;
    return (
      <Frame dark>
        <main
          className="oa-body"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)',
            gap: 28,
          }}
        >
          <div className="oa-burst" aria-hidden>
            <span className="ring" />
            {BURST.map(([dx, dy, c], i) => (
              <span
                key={i}
                className="bit"
                style={{
                  background: c,
                  ['--dx' as string]: `${dx}px`,
                  ['--dy' as string]: `${dy}px`,
                  animationDelay: `${0.12 + i * 0.0147}s`,
                }}
              />
            ))}
            <span className="tick">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          </div>
          <div role="status" className="flex flex-col gap-3">
            <h1 className="oa-title" style={{ color: '#f1f0ec', fontSize: 40 }}>
              See you {when}.
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.5,
                color: '#b5b3ad',
              }}
            >
              {first} reads your answers and all your quotes first, then calls you{phone ? ` on ${prettyPhone(phone)}` : ''}.
            </p>
            {sample ? <p className="oa-sample">Test build · nothing was booked</p> : null}
          </div>
          <ol className="oa-next-steps">
            {NEXT.map((step, i) => (
              <li key={step}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <span>{step.replace('{expert}', first).replace('{n} ', studioIds.length > 1 ? `${studioIds.length} ` : '')}</span>
              </li>
            ))}
          </ol>
        </main>
        <Foot>
          <Cta href="/app/choose" tone="ghost">
            Next: meet your studios
          </Cta>
        </Foot>
      </Frame>
    );
  }

  return (
    <Frame>
      <section className="oa-dark" style={{ paddingBottom: 26 }}>
        <Head back="/app/compare" meta="Free, 30 minutes" />
        <div style={{ padding: '0 22px' }}>
          <h1 className="oa-title" style={{ color: '#fff' }}>
            Your expert is on our payroll. Never a studio&rsquo;s.
          </h1>
          <div className="mt-5 flex items-center gap-4">
            <span className="oa-avatar" aria-hidden>
              {first.charAt(0)}
            </span>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.45,
                color: 'rgba(255,255,255,.85)',
              }}
            >
              {first} reads your answers and all {studioIds.length || 'your'} quotes first. She earns the same whichever studio you pick.
            </p>
          </div>
        </div>
      </section>
      <Body>
        {days.length === 0 ? (
          <>
            <h2 className="oa-label">No open times this week</h2>
            <p className="oa-sub">Tell us when suits you and we will call to fix a time.</p>
          </>
        ) : (
          <>
            <p className="oa-label">Pick a day</p>
            <div className="oa-days">
              {days.map((d, i) => (
                <button
                  key={d.first}
                  type="button"
                  className="oa-day"
                  aria-pressed={i === day}
                  onClick={() => {
                    setDay(i);
                    setSlot(null);
                  }}
                >
                  <small>{fmt(d.first, { weekday: 'short' })}</small>
                  <b>{fmt(d.first, { day: 'numeric' })}</b>
                </button>
              ))}
            </div>
            <p className="oa-label">Pick a time</p>
            <div className="oa-times">
              {days[day]!.times.map((t) => (
                <button key={t} type="button" className="oa-time" aria-pressed={t === slot} onClick={() => setSlot(t)}>
                  {timeOf(t)}
                </button>
              ))}
            </div>
            {sample ? <p className="oa-sample">Test build · usual hours shown, nothing is booked</p> : null}
            {error ? (
              <p className="oa-note" role="alert" style={{ color: 'var(--accent-ink)' }}>
                {error}
              </p>
            ) : null}
          </>
        )}
      </Body>
      <Foot>
        {days.length === 0 ? (
          <Cta href="/expert">Ask for a call</Cta>
        ) : (
          <Cta onClick={() => void book()} disabled={!slot || busy}>
            {busy ? 'Booking…' : label ? `Book ${label}` : 'Pick a time'}
          </Cta>
        )}
      </Foot>
    </Frame>
  );
}

/** The matched studios' ids, for the consultation record — the same three the quotes came from. */
function useStudioIds(data: AppData | null): string[] {
  const empty = useMemo(() => ({ studios: [], rates: {}, allowUnverified: false, sample: true, ratesReal: false }) as AppData, []);
  const { matches } = useJourney(data ?? empty);
  return matches.map((m) => m.studio.id);
}

function prettyPhone(p: string): string {
  const d = p.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : p;
}
