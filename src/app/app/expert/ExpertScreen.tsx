'use client';

/**
 * Expert call (the owner's v1 screens): who the expert is and who pays her,
 * then a day and a time. Booking goes through the website's expert form with
 * the slot already picked, so there is one booking path, not two. A test
 * build books nothing and says so.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';

const TZ = 'Asia/Kolkata';
const DAYS_SHOWN = 4;
const TIMES_SHOWN = 6;

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

  const book = () => {
    if (!slot) return;
    if (sample) return setBooked(true);
    router.push(`/expert?slot=${encodeURIComponent(slot)}`);
  };

  if (booked && label) {
    return (
      <Frame>
        <Head back={() => setBooked(false)} meta="Booked" />
        <Body>
          <h1 className="oa-title">{label}. {first} will call you.</h1>
          <p className="oa-sub">She reads your answers and all three quotes before the call, so it starts where the studios differ.</p>
          <p className="oa-sample">Test build · nothing was booked</p>
        </Body>
        <Foot>
          <Cta href="/app/home">See what happens after you sign</Cta>
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
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'rgba(255,255,255,.85)' }}>
              {expert} reads your answers and all 3 quotes first. She earns the same whichever studio you pick.
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
          </>
        )}
      </Body>
      <Foot>
        {days.length === 0 ? (
          <Cta href="/expert">Ask for a call</Cta>
        ) : (
          <Cta onClick={book} disabled={!slot}>
            {label ? `Book ${label}` : 'Pick a time'}
          </Cta>
        )}
      </Foot>
    </Frame>
  );
}
