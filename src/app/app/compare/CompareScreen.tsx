'use client';

/**
 * Compare (the owner's v1 screens): the gap said in plain words first, then
 * the rows that explain it. Every sentence and cell is read off the quotes or
 * the studio's record; a cell that differs from the others is marked, never
 * called better or worse.
 */

import { Body, Cta, Foot, Frame, Head } from '@/components/app/ui';
import { useJourney } from '@/components/app/useJourney';
import { formatINRCompact } from '@/lib/money';
import { lateness, plainWords, type AppQuote } from '@/modules/app/journey';
import type { Studio } from '@/modules/studio/types';
import { useAppData } from '@/components/app/useAppData';
import type { AppData } from '../data';

/** The first part of a " · " spec, e.g. "18mm BWP carcass". */
const head = (spec: string | undefined) => spec?.split(' · ')[0]?.replace(/ carcass$/, '') ?? '—';

function wardrobeBoard(q: AppQuote): string {
  return head(q.quote.lines.find((l) => /wardrobe/i.test(l.label))?.spec);
}

/** A part of the kitchen's spec, e.g. its shutter or its counter; "—" when the quote does not say. */
function kitchenPart(q: AppQuote, part: RegExp): string {
  for (const l of q.quote.lines.filter((x) => x.room === 'KITCHEN')) {
    const hit = l.spec.split(' · ').find((p) => part.test(p));
    if (hit) return hit;
  }
  return '—';
}

/** Median of the studio's finished projects, in weeks; null without a record. */
function handoverWeeks(studio: Studio | undefined): string {
  const days = (studio?.portfolio ?? [])
    .map((p) => p.durationDays)
    .filter((d): d is number => typeof d === 'number' && d > 0)
    .sort((a, b) => a - b);
  if (days.length === 0) return 'No record';
  return `${Math.round(days[Math.floor(days.length / 2)]! / 7)} weeks`;
}

function oddOut(values: string[]): boolean[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const top = Math.max(...counts.values());
  if (top === values.length || top === 1) return values.map(() => false);
  return values.map((v) => v !== '—' && counts.get(v)! < top);
}

export function CompareScreen({ data }: { data: AppData }) {
  const { brief, matches, quotes } = useJourney(data);

  if (!brief) return <Frame>{null}</Frame>;

  if (quotes.length < 2) {
    return (
      <Frame>
        <Head back="/app/quote" />
        <Body>
          <h1 className="oa-title">Nothing to compare yet.</h1>
          <p className="oa-sub">A comparison needs at least two studios priced on your brief.</p>
        </Body>
        <Foot>
          <Cta href="/app/q/1">Change my answers</Cta>
        </Foot>
      </Frame>
    );
  }

  const studio = (slug: string) => matches.find((m) => m.studio.slug === slug)?.studio;
  const cols = `repeat(${quotes.length}, minmax(0, 1fr))`;
  const rows: { label: string; values: string[]; mark?: boolean }[] = [
    { label: 'Wardrobe board', values: quotes.map(wardrobeBoard), mark: true },
    {
      label: 'Kitchen shutter',
      values: quotes.map((q) => kitchenPart(q, /shutter/i)),
      mark: true,
    },
    {
      label: 'Kitchen counter',
      values: quotes.map((q) => kitchenPart(q, /quartz|granite|counter/i)),
      mark: true,
    },
    {
      label: 'Time to handover',
      values: quotes.map((q) => handoverWeeks(studio(q.slug))),
    },
    {
      label: 'Usually late by',
      values: quotes.map((q) => {
        const s = studio(q.slug);
        const late = s ? lateness(s) : null;
        if (!late) return 'No record';
        return / late$/.test(late) ? late.replace(/^Usually /, '').replace(/ late$/, '') : 'On time';
      }),
    },
  ].filter((r) => r.values.some((v) => v !== '—'));

  return (
    <Frame>
      <section className="oa-dark" style={{ paddingBottom: 26 }}>
        <Head back="/app/quote" meta="Same lines, same units" />
        <div style={{ padding: '0 22px' }}>
          <h1 className="oa-title" style={{ color: '#fff' }}>
            In plain words
          </h1>
          {plainWords(quotes).map((p) => (
            <p
              key={p}
              style={{
                margin: '14px 0 0',
                fontSize: 16,
                lineHeight: 1.55,
                color: 'rgba(255,255,255,.85)',
              }}
            >
              {p}
            </p>
          ))}
        </div>
      </section>
      <Body>
        <div className="oa-cmp" style={{ gridTemplateColumns: cols }}>
          {quotes.map((q) => (
            <span key={q.slug} className="oa-cmp-cell" style={{ font: '600 15px var(--sans)' }}>
              {q.name}
            </span>
          ))}
          <span className="oa-cmp-label">Total</span>
          {quotes.map((q) => (
            <span key={q.slug} className="oa-cmp-cell big">
              {formatINRCompact(q.quote.totalPaise)}
            </span>
          ))}
          {rows.map((r) => {
            const odd = r.mark ? oddOut(r.values) : r.values.map(() => false);
            return [
              <span key={r.label} className="oa-cmp-label">
                {r.label}
              </span>,
              ...r.values.map((v, i) => (
                <span key={`${r.label}-${quotes[i]!.slug}`} className={`oa-cmp-cell${odd[i] ? ' worse' : ''}`}>
                  {v}
                </span>
              )),
            ];
          })}
        </div>
        {!data.ratesReal ? (
          <p className="oa-note">Pre-launch: these totals use archive rates, not yet each studio&rsquo;s own.</p>
        ) : null}
      </Body>
      <Foot>
        <Cta href="/app/expert">Talk it through with an expert</Cta>
        <p className="oa-foot-note">Free, 30 minutes, no studio on the call</p>
      </Foot>
    </Frame>
  );
}

/** The screen once the studio data is here — usually already, since the quiz fetches it early. */
export function Compare() {
  const data = useAppData();
  return data ? <CompareScreen data={data} /> : <Frame>{null}</Frame>;
}
