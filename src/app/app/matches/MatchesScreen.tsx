'use client';

/**
 * Matches (v79 design, 9 Oct 2026): three studios scored on the brief, with
 * a tier switch to see who fits if they went a band up or down, "Edit my
 * answers", tappable cards that open the studio's profile, and a way to see
 * every verified studio.
 *
 * The switch only previews. The brief's tier changes when they go on to get
 * quotes from what they are looking at, so the quotes match the matches.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Body, Cta, Foot, Frame, Head, useBrief } from '@/components/app/ui';
import { filedRatesFor } from '@/data/filed-rates';
import { carpetAreaFor } from '@/modules/brief/steps';
import { lateness, quotesFor, topMatches } from '@/modules/app/journey';
import { TIER, TIERS, tierRangeFor, type Tier } from '@/modules/quotation/tiers';
import { formatINRCompact } from '@/lib/money';
import { useAppData } from '@/components/app/useAppData';
import type { AppData } from '../data';

const WORDS = ['No studios', 'One studio', 'Two studios', 'Three studios'];

export function MatchesScreen({ data }: { data: AppData }) {
  const router = useRouter();
  const [brief, update] = useBrief();
  const [tier, setTier] = useState<Tier | null>(null);
  const shown: Tier = tier ?? brief?.tier ?? 'PREMIUM';

  const { matches, quotes } = useMemo(() => {
    if (!brief?.completedAt) return { matches: [], quotes: [] };
    const b = { ...brief, tier: shown };
    const m = topMatches(b, data.studios, data.rates, filedRatesFor, data.allowUnverified);
    return { matches: m, quotes: quotesFor(b, m, data.rates, filedRatesFor) };
  }, [brief, data, shown]);
  const listed = verifiedCount(data);

  if (!brief) return <Frame>{null}</Frame>;

  if (!brief.completedAt || matches.length === 0) {
    return (
      <Frame>
        <Head back="/app" />
        <Body>
          <h1 className="oa-title">{brief.completedAt ? 'No studio fits all of that yet.' : 'Seven questions first.'}</h1>
          <p className="oa-sub">
            {brief.completedAt
              ? 'We would rather say so than show you a studio that does not fit. Change an answer and we will look again.'
              : 'Your matches are worked out from your answers, so they come after the brief.'}
          </p>
          {brief.completedAt ? <TierSwitch value={shown} onChange={setTier} /> : null}
        </Body>
        <Foot>
          <Cta href="/app/q/1">{brief.completedAt ? 'Change my answers' : 'Start the brief'}</Cta>
        </Foot>
      </Frame>
    );
  }

  const { sqft } = carpetAreaFor(brief);
  const range = tierRangeFor(shown, sqft);
  const rangeWords =
    range.highPaise === null
      ? `${formatINRCompact(range.lowPaise)} and up`
      : `${formatINRCompact(range.lowPaise)}–${formatINRCompact(range.highPaise)}`;
  const chose = brief.tier ? TIER[brief.tier].label : null;
  const quoteOf = new Map(quotes.map((q) => [q.slug, q.quote]));

  const go = () => {
    if (shown !== brief.tier) {
      update({ tier: shown, budgetMinPaise: range.lowPaise, budgetMaxPaise: range.highPaise });
    }
    router.push('/app/verify');
  };

  return (
    <Frame>
      <Head
        back="/app/style"
        meta={
          <Link href="/app/q/1" className="oa-head-link">
            Edit my answers
          </Link>
        }
      />
      <Body>
        <p className="oa-note">
          {listed} verified studios in Pune · {matches.length} matched for you
        </p>
        <h1 className="oa-title">
          {WORDS[matches.length] ?? `${matches.length} studios`}, scored on your brief. Never on who paid.
        </h1>

        <TierSwitch value={shown} onChange={setTier} />
        <p className="oa-note">
          {chose && shown !== brief.tier ? `You chose ${chose}. These are the best matches if you go ${TIER[shown].label}` : `Best matches for ${TIER[shown].label}`}
          , at about {rangeWords} for your flat before GST.
        </p>

        <div className="oa-list">
          {matches.map(({ match, studio }, i) => {
            const counted = studio.checks.filter((c) => c.result !== 'NOT_APPLICABLE');
            const passed = counted.filter((c) => c.result === 'PASS').length;
            const late = lateness(studio);
            const q = quoteOf.get(studio.slug);
            const reasons = [match.topPriority, ...match.reasoning.filter((r) => r !== match.topPriority)]
              .filter((r): r is string => Boolean(r))
              .slice(0, i === 0 ? 3 : 1);
            return (
              <Link key={studio.id} href={`/app/studios/${studio.slug}`} className={`oa-match tap${i === 0 ? ' first' : ''}`}>
                <div className="oa-match-top">
                  <span className="oa-score" aria-label={`Match ${Math.round(match.score)}`}>
                    {Math.round(match.score)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2>{studio.tradeName}</h2>
                    <p className="oa-match-why">{studio.about.split(/(?<=[.;])\s/)[0]}</p>
                    {q ? (
                      <p className="oa-match-range">
                        {formatINRCompact(q.lowPaise)}–{formatINRCompact(q.highPaise)} for your brief
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="oa-chips mt-3">
                  <span className="oa-chip small static">
                    {passed}/{counted.length} checks
                  </span>
                  {late ? <span className="oa-chip small static">{late}</span> : null}
                </div>
                {reasons.length > 0 ? (
                  <>
                    {i === 0 ? <p className="oa-label">Why they suit you</p> : null}
                    <ul className="oa-bullets">
                      {reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <span className="oa-match-more">See their homes, checks and record</span>
              </Link>
            );
          })}
        </div>
        <Link href="/app/studios" className="oa-share-row" style={{ textDecoration: 'none' }}>
          <span>
            <b>See all {listed} verified studios</b>
            <small>Filter by area, style and budget</small>
          </span>
          <span className="go" aria-hidden>
            →
          </span>
        </Link>
      </Body>
      <Foot>
        <Cta onClick={go}>Get quotes from {matches.length === 1 ? 'this studio' : `these ${matches.length}`}</Cta>
      </Foot>
    </Frame>
  );
}

/** The studios a customer can be matched with: matching's own first filter (score.ts `failedFilter`). */
export function listedStudios(data: AppData): AppData['studios'] {
  return data.studios.filter((s) => !s.pausedAt && (data.allowUnverified || (s.status === 'ACTIVE' && s.tier !== 'UNVERIFIED')));
}
export function verifiedCount(data: AppData): number {
  return listedStudios(data).length;
}

function TierSwitch({ value, onChange }: { value: Tier; onChange: (t: Tier) => void }) {
  return (
    <div className="oa-seg" role="radiogroup" aria-label="Finish level">
      {TIERS.map((t) => (
        <button key={t} type="button" role="radio" aria-checked={value === t} onClick={() => onChange(t)}>
          {TIER[t].label}
        </button>
      ))}
    </div>
  );
}

/** The screen once the studio data is here — usually already, since the quiz fetches it early. */
export function Matches() {
  const data = useAppData();
  return data ? <MatchesScreen data={data} /> : <Frame>{null}</Frame>;
}
