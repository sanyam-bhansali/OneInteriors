'use client';

/** Matches (the owner's v1 screens): three studios, scored on the brief, each with its reasons. */

import Link from 'next/link';
import { useMemo } from 'react';
import { Body, Cta, Foot, Frame, Head, useBrief } from '@/components/app/ui';
import { VERIFIED_STUDIOS } from '@/lib/claims';
import { filedRatesFor } from '@/data/filed-rates';
import { lateness, topMatches } from '@/modules/app/journey';
import type { AppData } from '../data';

const WORDS = ['No studios', 'One studio', 'Two studios', 'Three studios'];

export function MatchesScreen({ data }: { data: AppData }) {
  const [brief] = useBrief();
  const matches = useMemo(
    () => (brief?.completedAt ? topMatches(brief, data.studios, data.rates, filedRatesFor, data.allowUnverified) : []),
    [brief, data],
  );

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
        </Body>
        <Foot>
          <Cta href="/app/q/1">{brief.completedAt ? 'Change my answers' : 'Start the brief'}</Cta>
        </Foot>
      </Frame>
    );
  }

  return (
    <Frame>
      <Head back="/app/q/7" meta={`${VERIFIED_STUDIOS} studios, ${matches.length} matches`} />
      <Body>
        <h1 className="oa-title">
          {WORDS[matches.length] ?? `${matches.length} studios`}, scored on your brief. Never on who paid.
        </h1>
        <div className="oa-list" style={{ borderTop: '1px solid var(--line)' }}>
          {matches.map(({ match, studio }, i) => {
            const counted = studio.checks.filter((c) => c.result !== 'NOT_APPLICABLE');
            const passed = counted.filter((c) => c.result === 'PASS').length;
            const late = lateness(studio);
            const reasons = [match.topPriority, ...match.reasoning.filter((r) => r !== match.topPriority)]
              .filter((r): r is string => Boolean(r))
              .slice(0, 3);
            return (
              <article key={studio.id} className={`oa-match${i === 0 ? ' first' : ''}`}>
                <div className="oa-match-top">
                  <span className="oa-score" aria-label={`Score ${Math.round(match.score)}`}>
                    {Math.round(match.score)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2>{studio.tradeName}</h2>
                    <p className="oa-match-why">{studio.about.split(/(?<=[.;])\s/)[0]}</p>
                    <div className="oa-bar">
                      <i style={{ width: `${Math.round(match.score)}%` }} />
                    </div>
                  </div>
                </div>
                <div className="oa-chips mt-3.5">
                  <span className="oa-chip small" style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center' }}>
                    {passed}/{counted.length} checks
                  </span>
                  <span className="oa-chip small" style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center' }}>
                    Scored on {match.factorsScored} of {match.factorsTotal}
                  </span>
                  {late ? (
                    <span className="oa-chip small" style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center' }}>
                      {late}
                    </span>
                  ) : null}
                </div>
                {i === 0 ? (
                  <ul className="oa-bullets">
                    {reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : reasons[0] ? (
                  <p className="oa-note mt-3">{reasons[0]}</p>
                ) : null}
              </article>
            );
          })}
        </div>
        <Link href="/match" className="oa-note" style={{ textDecoration: 'underline' }}>
          See every studio and why the others did not fit
        </Link>
      </Body>
      <Foot>
        <Cta href="/app/verify">Get quotes from all {matches.length}</Cta>
      </Foot>
    </Frame>
  );
}
