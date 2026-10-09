'use client';

/**
 * All studios (v79 design): every studio a customer could be matched with,
 * filtered by band or by their own area, each scored on their brief when
 * there is one. Same filter and same score as the matches, so a studio never
 * scores differently on two screens.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Body, Frame, Head, useBrief } from '@/components/app/ui';
import { filedRatesFor } from '@/data/filed-rates';
import { scoreMatch } from '@/modules/matching/score';
import { localityLabel } from '@/modules/brief/types';
import { TIER, TIERS, type Tier } from '@/modules/quotation/tiers';
import { lateness } from '@/modules/app/journey';
import { useAppData } from '@/components/app/useAppData';
import { listedStudios } from '../matches/MatchesScreen';
import type { AppData } from '../data';

type Filter = 'ALL' | 'NEAR' | Tier;

export function StudiosScreen({ data }: { data: AppData }) {
  const [brief] = useBrief();
  const [filter, setFilter] = useState<Filter>('ALL');
  const all = useMemo(() => listedStudios(data), [data]);
  const near = brief?.locality ?? null;

  const rows = useMemo(() => {
    const scored = all.map((s) => {
      const m = brief?.completedAt
        ? scoreMatch(brief, s, { allowUnverified: data.allowUnverified, ratesFor: (slug) => data.rates[slug] ?? filedRatesFor(slug) })
        : null;
      return { s, score: m ? Math.round(m.score) : null };
    });
    return scored
      .filter(({ s }) =>
        filter === 'ALL' ? true : filter === 'NEAR' ? Boolean(near && s.localities.includes(near)) : s.band === filter,
      )
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.s.tradeName.localeCompare(b.s.tradeName));
  }, [all, brief, data, filter, near]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    ...(near ? [{ key: 'NEAR' as const, label: `Works in ${localityLabel(near)}` }] : []),
    ...TIERS.map((t) => ({ key: t as Filter, label: TIER[t].label })),
  ];

  return (
    <Frame>
      <Head meta="Every studio passed our checks" />
      <Body>
        <h1 className="oa-title">All {all.length} studios in Pune</h1>
        <div className="oa-chips" role="group" aria-label="Filter">
          {filters.map((f) => (
            <button key={f.key} type="button" className="oa-chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <p className="oa-note">
          {rows.length === all.length ? `Showing all ${all.length}` : `${rows.length} of ${all.length}`}
          {brief?.completedAt ? ', scored on your brief' : ''}
        </p>
        <div className="oa-list">
          {rows.map(({ s, score }) => {
            const counted = s.checks.filter((c) => c.result !== 'NOT_APPLICABLE');
            const passed = counted.filter((c) => c.result === 'PASS').length;
            const meta = [
              s.localities[0] ? localityLabel(s.localities[0]) : null,
              s.yearsActive ? `${s.yearsActive} yrs` : null,
              `${passed}/${counted.length} checks`,
              lateness(s),
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <Link key={s.id} href={`/app/studios/${s.slug}`} className="oa-studio-row">
                <span className="initial" aria-hidden>
                  {s.tradeName.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <b>{s.tradeName}</b>
                  <small>{s.about.split(/(?<=[.;])\s/)[0]}</small>
                  <em>{meta}</em>
                </span>
                {score !== null ? (
                  <span className="score">
                    {score}
                    <small>match</small>
                  </span>
                ) : null}
              </Link>
            );
          })}
          {rows.length === 0 ? <p className="oa-note" style={{ padding: '16px 0' }}>No studio fits that filter yet.</p> : null}
        </div>
      </Body>
    </Frame>
  );
}

export function Studios() {
  const data = useAppData();
  return data ? <StudiosScreen data={data} /> : <Frame>{null}</Frame>;
}
