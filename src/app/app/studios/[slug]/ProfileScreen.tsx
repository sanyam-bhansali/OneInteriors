'use client';

/**
 * Studio profile (v79 design): a photo header, the match score, why they
 * suit you, and four tabs — Past homes, Checks, Delivery record, Reviews.
 *
 * Every number is the studio's real record or says it has none. Checks show
 * what each one means, where it came from and when (the trust fix: a badge
 * whose rules are public). Reviews come only from customers whose project
 * went through One Interiors, so until there are some the tab says so.
 */

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Body, Cta, Foot, Frame, Head, useBrief } from '@/components/app/ui';
import { filedRatesFor } from '@/data/filed-rates';
import { scoreMatch } from '@/modules/matching/score';
import { localityLabel, STYLE_LABELS } from '@/modules/brief/types';
import { CHECK_LABELS, CHECK_MEANINGS, describeDelivery, type VerificationCheck } from '@/modules/studio/types';
import { formatINRCompact } from '@/lib/money';
import { useAppData } from '@/components/app/useAppData';
import type { AppData } from '../../data';

type Tab = 'homes' | 'checks' | 'record' | 'reviews';
const TABS: { key: Tab; label: string }[] = [
  { key: 'homes', label: 'Past homes' },
  { key: 'checks', label: 'Checks' },
  { key: 'record', label: 'Delivery record' },
  { key: 'reviews', label: 'Reviews' },
];

const HOME_LABEL: Record<string, string> = {
  BHK_1: '1 BHK',
  BHK_2: '2 BHK',
  BHK_3: '3 BHK',
  BHK_4_PLUS: '4+ BHK',
  VILLA: 'Villa',
};

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function ProfileScreen({ data, slug }: { data: AppData; slug: string }) {
  const router = useRouter();
  const [brief] = useBrief();
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== 'undefined' && window.location.hash === '#checks' ? 'checks' : 'homes',
  );
  const studio = data.studios.find((s) => s.slug === slug);
  const match = useMemo(
    () =>
      studio && brief?.completedAt
        ? scoreMatch(brief, studio, { allowUnverified: data.allowUnverified, ratesFor: (s) => data.rates[s] ?? filedRatesFor(s) })
        : null,
    [brief, data, studio],
  );

  if (!studio) {
    return (
      <Frame>
        <Head back="/app/studios" />
        <Body>
          <h1 className="oa-title">We could not find that studio.</h1>
          <p className="oa-sub">It may have paused new work. Every studio taking work is on the full list.</p>
        </Body>
        <Foot>
          <Cta href="/app/studios">See all studios</Cta>
        </Foot>
      </Frame>
    );
  }

  const counted = studio.checks.filter((c) => c.result !== 'NOT_APPLICABLE');
  const passed = counted.filter((c) => c.result === 'PASS');
  const lastChecked = passed
    .map((c) => c.checkedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();
  const cover = studio.portfolio.find((p) => p.images.length > 0)?.images[0] ?? null;
  const verified = studio.tier === 'VERIFIED' || studio.tier === 'PROVEN';
  const meta = [
    studio.localities[0] ? localityLabel(studio.localities[0]) : null,
    studio.yearsActive ? `${studio.yearsActive} years` : null,
    studio.teamSize ? `team of ${studio.teamSize}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const reasons = match
    ? [match.topPriority, ...match.reasoning.filter((r) => r !== match.topPriority)].filter((r): r is string => Boolean(r)).slice(0, 3)
    : [];
  const homes = [...studio.portfolio].sort((a, b) => (b.completedOn ?? '').localeCompare(a.completedOn ?? ''));

  return (
    <Frame>
      <header className="oa-profile-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover ? <img src={cover} alt="" className="cover" /> : null}
        <div className="shade" />
        <Head back={() => router.back()} meta={verified ? <span style={{ color: '#fff' }}>Verified by One Interiors</span> : null} />
        <div className="who">
          <h1>{studio.tradeName}</h1>
          {meta ? <p>{meta}</p> : null}
        </div>
      </header>
      <Body>
        <div className="oa-profile-stats">
          <div>
            <b>{match ? Math.round(match.score) : '—'}</b>
            <span>{match ? 'Match for you' : 'Finish the brief to score'}</span>
          </div>
          <div>
            <b>{passed.length}/{counted.length}</b>
            <span>Checks passed</span>
          </div>
          <div>
            <b>{studio.completedProjects}</b>
            <span>Homes handed over with us</span>
          </div>
        </div>

        {reasons.length > 0 ? (
          <section>
            <p className="oa-label">Why they suit you</p>
            <ul className="oa-bullets">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="oa-tabs-inline" role="tablist" aria-label="About this studio">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'homes' ? (
          homes.length === 0 ? (
            <p className="oa-note">No past homes on file yet.</p>
          ) : (
            <div className="oa-homes">
              {homes.map((p) => (
                <article key={p.id}>
                  {p.images[0] ? (
                    <div className="pic">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.images[0]} alt={p.title} loading="lazy" />
                      {p.isRender ? <span className="render">Render</span> : null}
                    </div>
                  ) : null}
                  <b>
                    {[p.propertyType ? HOME_LABEL[p.propertyType] : null, localityLabel(p.locality)].filter(Boolean).join(', ') || p.title}
                  </b>
                  <span>
                    {[
                      p.valuePaise ? formatINRCompact(p.valuePaise) : null,
                      p.durationDays ? `${Math.round(p.durationDays / 7)} weeks` : null,
                      p.styleTags[0] ? STYLE_LABELS[p.styleTags[0]] : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </article>
              ))}
            </div>
          )
        ) : null}

        {tab === 'checks' ? (
          <section className="oa-checks">
            <p className="oa-sub" style={{ margin: 0 }}>
              {passed.length} of {counted.length} checks passed.
              {lastChecked ? ` Last checked ${day(lastChecked)}.` : ''} Every studio goes through the same checks before it can be
              matched. We show the result and the date, never the documents.
            </p>
            <ul>
              {counted.map((c) => (
                <CheckRow key={c.type} c={c} />
              ))}
            </ul>
          </section>
        ) : null}

        {tab === 'record' ? (
          <section className="oa-card">
            <p className="oa-label" style={{ marginTop: 0 }}>
              From our own project data
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 16, lineHeight: 1.5 }}>{describeDelivery(studio)}</p>
            <p className="oa-note" style={{ marginTop: 10 }}>
              Counted only on homes that went through One Interiors, planned handover against actual.
            </p>
          </section>
        ) : null}

        {tab === 'reviews' ? (
          <section className="oa-card">
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>No reviews yet</p>
            <p className="oa-note" style={{ marginTop: 6 }}>
              Only customers whose project went through One Interiors can review, after handover. Reviews appear here as they
              come in.
            </p>
          </section>
        ) : null}
      </Body>
      <Foot>
        <Cta href={brief?.completedAt ? '/app/verify' : '/app/name'}>
          {brief?.completedAt ? `Get my quote from ${studio.tradeName}` : 'Start my brief'}
        </Cta>
      </Foot>
    </Frame>
  );
}

function CheckRow({ c }: { c: VerificationCheck }) {
  const ok = c.result === 'PASS';
  return (
    <li>
      <span className={`st${ok ? ' pass' : ''}`} aria-label={ok ? 'Passed' : 'Not done yet'}>
        {ok ? '✓' : '…'}
      </span>
      <span>
        <b>{CHECK_LABELS[c.type]}</b>
        <small>{CHECK_MEANINGS[c.type]}</small>
        <em>{ok ? [c.source, c.checkedAt ? day(c.checkedAt) : null].filter(Boolean).join(' · ') : 'Not done yet'}</em>
      </span>
    </li>
  );
}

export function Profile() {
  const data = useAppData();
  const { slug } = useParams<{ slug: string }>();
  return data ? <ProfileScreen data={data} slug={slug} /> : <Frame>{null}</Frame>;
}
