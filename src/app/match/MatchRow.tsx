'use client';

/**
 * One studio, as something worth reading.
 *
 * ## What went wrong the first time
 *
 * The screen before this was 483 lines and confusing. I replaced it with a
 * name, a score and two buttons — and that was not simpler, it was emptier.
 * The confusion came from the old screen asking the reader to understand the
 * matching engine before they could understand the studio; it did not come
 * from the information itself. Stripping the information out removed the
 * reason to stay on the page at all.
 *
 * So the rule here is: **every number on this row is about the studio, not
 * about us.** Delivered project values, homes finished on this customer's own
 * street, days over the promised date, checks cleared. Nothing about weights,
 * nothing about engine versions, no "factor breakdown" the reader has to
 * learn to read.
 *
 * ## Collapsed, then as deep as they want
 *
 * The row opens with the written assessment and the four figures that decide
 * a shortlist. Everything else — the work itself, what they are strong and
 * weak at, where they build — is one click away and stays open. Somebody
 * skimming six studios is not slowed down; somebody comparing two can sit in
 * it.
 *
 * ## The strength bars
 *
 * Four bars, not six, and never a percentage. A percentage invites arithmetic
 * ("62% style match") that the underlying score cannot support. A bar at three
 * of four says "strong on this" and stops, which is what the number actually
 * means.
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatINRCompact } from '@/lib/money';
import { CHECK_COUNT } from '@/components/landing/checks';
import { STYLE_LABELS } from '@/modules/brief/types';
import type { MatchResult } from '@/modules/matching/score';
import type { Explanation } from '@/modules/matching/explain';
import type { Studio } from '@/modules/studio/types';
import type { Brief } from '@/modules/brief/types';
import { Sheet, Tick, Flag } from '@/components/oi';
import { explainAction } from './actions';

// ── Small pieces ────────────────────────────────────────────────

function Ring({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex h-[68px] w-[68px] flex-none items-center justify-center">
      <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden className="absolute inset-0">
        <circle cx="34" cy="34" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
        <circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke="var(--sec)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          transform="rotate(-90 34 34)"
        />
      </svg>
      <span className="oi-num relative text-[19px] leading-none">{score}</span>
    </span>
  );
}

/** Four bars. Never a percentage — see the note at the top of this file. */
function Strength({ label, value }: { label: string; value: number | null }) {
  const level = value === null ? 0 : Math.max(1, Math.min(4, Math.ceil((value / 100) * 4)));

  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-2 last:border-b-0">
      <span className="text-[13.5px] text-[var(--ink2)]">{label}</span>
      {value === null ? (
        <span className="oi-num text-[10px] uppercase tracking-[0.14em] text-[var(--ink2)]">
          not known yet
        </span>
      ) : (
        <span className="flex items-end gap-[3px]" aria-label={`${level} of 4`}>
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-[5px] rounded-[1px]"
              style={{
                height: 6 + i * 3,
                background: i <= level ? 'var(--sec)' : 'var(--line)',
              }}
            />
          ))}
        </span>
      )}
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="oi-num m-0 text-[17px] leading-none">{value}</p>
      <p className="oi-num m-0 mt-1.5 text-[9.5px] uppercase leading-snug tracking-[0.14em] text-[var(--ink2)]">
        {label}
      </p>
    </div>
  );
}

// ── The row ─────────────────────────────────────────────────────

export function MatchRow({
  studio,
  match,
  brief,
  rank,
  quotedTotalPaise,
  inCompare,
  onQuote,
  onToggleCompare,
}: {
  studio: Studio;
  match: MatchResult;
  brief: Brief;
  rank: number;
  quotedTotalPaise: number | null;
  inCompare: boolean;
  onQuote: () => void;
  onToggleCompare: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Explanation | null>(null);

  // The assessment arrives per row, so the page fills in rather than waiting
  // on the slowest call. Never blocks anything the reader can already use.
  useEffect(() => {
    let live = true;
    explainAction(brief, studio.id)
      .then((r) => {
        if (live && r.text) setRead(r);
      })
      .catch(() => {
        /* The row is complete without it. */
      });
    return () => {
      live = false;
    };
  }, [brief, studio.id]);

  const cleared = studio.checks.filter((c) => c.result === 'PASS').length;
  const localHomes = brief.locality
    ? studio.portfolio.filter((p) => p.locality === brief.locality).length
    : 0;

  const delivered = studio.portfolio
    .map((p) => p.valuePaise)
    .filter((v): v is number => v !== null);
  const low = delivered.length > 0 ? Math.min(...delivered) : null;
  const high = delivered.length > 0 ? Math.max(...delivered) : null;

  const shots = studio.portfolio.filter((p) => p.images.length > 0).slice(0, 4);
  const styles = [...new Set(studio.portfolio.flatMap((p) => p.styleTags))].slice(0, 4);

  return (
    <Sheet as="li" className="overflow-hidden">
      <div className="p-5 sm:p-6">
        {/* ── Who, and how well ── */}
        <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
          <Ring score={match.score} />

          <div className="min-w-0 flex-1">
            <p className="oi-num m-0 mb-1.5 text-[9.5px] uppercase tracking-[0.16em] text-[var(--ink2)]">
              Best fit no. {rank}
              {' · '}
              <span style={{ color: 'var(--sec-ink)' }}>
                {cleared}/{CHECK_COUNT} checks cleared
              </span>
              {' · '}scored on {match.factorsScored} of {match.factorsTotal}
            </p>

            <h2 className="oi-display m-0 mb-1 text-[23px]">{studio.tradeName}</h2>

            <p className="m-0 text-[13.5px] text-[var(--ink2)]">
              {studio.yearsActive ? `${studio.yearsActive} years` : 'Newly listed'}
              {studio.teamSize ? ` · team of ${studio.teamSize}` : ''}
              {studio.localities.length > 0
                ? ` · ${studio.localities.slice(0, 3).map(titleCase).join(', ')}`
                : ''}
            </p>
          </div>

          <div className="flex flex-none flex-wrap items-center gap-3">
            {quotedTotalPaise !== null ? (
              <>
                <span className="oi-num text-[19px]">{formatINRCompact(quotedTotalPaise)}</span>
                <button
                  type="button"
                  onClick={onToggleCompare}
                  className="cursor-pointer border px-4 py-2.5 text-[13.5px] font-medium transition-colors"
                  style={{
                    borderColor: inCompare ? 'var(--acc)' : 'var(--line)',
                    background: inCompare ? 'var(--acc-wash)' : 'var(--card)',
                  }}
                >
                  {inCompare ? 'In compare' : 'Add to compare'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onQuote}
                className="cursor-pointer px-5 py-2.5 text-[13.5px] font-medium text-white transition-colors"
                style={{ background: 'var(--acc-btn)' }}
              >
                Get a quote
              </button>
            )}
          </div>
        </div>

        {/* ── The written read ──
            Always present. Labelled by where it came from, because calling a
            template an AI summary is the kind of claim this product spends
            its whole landing page arguing against. */}
        <div
          className="mt-5 border-l-2 p-4"
          style={{ borderColor: 'var(--sec)', background: 'var(--bg)' }}
        >
          <p className="oi-num m-0 mb-2 text-[9.5px] uppercase tracking-[0.16em]" style={{ color: 'var(--sec-ink)' }}>
            {read?.source === 'model' ? 'Read by our AI' : 'Why this matched'}
          </p>

          {read ? (
            <p className="m-0 text-[14.5px] leading-[1.6]">{read.text}</p>
          ) : (
            <p className="m-0 text-[14.5px] leading-[1.6] text-[var(--ink2)]">
              Reading this studio against your brief…
            </p>
          )}

          {read?.source === 'model' ? (
            <p className="m-0 mt-2.5 text-[12px] leading-snug text-[var(--ink2)]">
              Written from the figures on this page only — it cannot add a project, a price or a
              place that is not on their record.
            </p>
          ) : null}
        </div>

        {/* ── The four figures that decide a shortlist ── */}
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[var(--line)] pt-5 sm:grid-cols-4">
          <Figure
            value={low !== null && high !== null ? `${formatINRCompact(low)}–${formatINRCompact(high)}` : '—'}
            label={delivered.length > 0 ? `${delivered.length} delivered projects` : 'nothing delivered yet'}
          />
          <Figure
            value={localHomes > 0 ? String(localHomes) : '—'}
            label={brief.locality ? `homes in ${titleCase(brief.locality)}` : 'locality not given'}
          />
          <Figure
            value={studio.avgVarianceDays !== null ? `${studio.avgVarianceDays}d` : '—'}
            label={studio.avgVarianceDays !== null ? 'average overrun' : 'no delivery record'}
          />
          <Figure
            value={
              studio.specComplianceRate !== null
                ? `${Math.round(studio.specComplianceRate * 100)}%`
                : '—'
            }
            label="built to the quote"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="oi-num cursor-pointer border-0 bg-transparent p-0 text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink2)] hover:text-[var(--ink)]"
          >
            {open ? '− Less' : '+ Their work, and where they are weak'}
          </button>
          <Link
            href={`/studios/${studio.slug}`}
            className="text-[13.5px] text-[var(--ink2)] underline hover:text-[var(--ink)]"
          >
            Full profile
          </Link>
        </div>
      </div>

      {/* ── The depth ──
          Always rendered so it can animate and so find-in-page reaches it. */}
      <div className="oi-reveal" data-open={open} aria-hidden={!open}>
        <div>
          <div className="border-t border-[var(--line)] bg-[var(--bg)] p-5 sm:p-6">
            {shots.length > 0 ? (
              <>
                <p className="oi-label m-0 mb-3">Their work</p>
                <ul className="oi-rail m-0 mb-6 flex list-none gap-3 overflow-x-auto p-0">
                  {shots.map((project) => (
                    <li key={project.id} className="w-[180px] flex-none">
                      <Image
                        src={project.images[0]!}
                        alt={project.title}
                        width={360}
                        height={270}
                        sizes="180px"
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <p className="m-0 mt-2 truncate text-[12.5px]">{project.title}</p>
                      <p className="oi-num m-0 text-[9.5px] uppercase tracking-[0.12em] text-[var(--ink2)]">
                        {project.locality ? `${titleCase(project.locality)} · ` : ''}
                        {project.valuePaise ? formatINRCompact(project.valuePaise) : 'value not given'}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
              <div>
                <p className="oi-label m-0 mb-2">Where they are strong</p>
                <Strength label="Your style" value={match.breakdown.styleOverlap} />
                <Strength label="Your budget" value={match.breakdown.budgetFit} />
                <Strength label="Delivering on time" value={match.breakdown.deliveryReliability} />
                <Strength label="Working the way you want" value={match.breakdown.workingStyle} />
              </div>

              <div>
                <p className="oi-label m-0 mb-2">Worth knowing</p>

                {styles.length > 0 ? (
                  <p className="m-0 mb-3 flex flex-wrap gap-1.5">
                    {styles.map((tag) => (
                      <span
                        key={tag}
                        className="oi-num border border-[var(--line)] px-2 py-1 text-[9.5px] uppercase tracking-[0.12em] text-[var(--ink2)]"
                      >
                        {STYLE_LABELS[tag] ?? tag}
                      </span>
                    ))}
                  </p>
                ) : null}

                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {studio.upheldDisputes > 0 ? (
                    <li>
                      <Flag>
                        {studio.upheldDisputes} upheld dispute
                        {studio.upheldDisputes === 1 ? '' : 's'}
                      </Flag>
                    </li>
                  ) : null}

                  {cleared < CHECK_COUNT ? (
                    <li>
                      <Flag>
                        {CHECK_COUNT - cleared} check
                        {CHECK_COUNT - cleared === 1 ? '' : 's'} still outstanding
                      </Flag>
                    </li>
                  ) : (
                    <li className="flex items-center gap-2 text-[13.5px]">
                      <Tick style={{ color: 'var(--sec)' }} />
                      All {CHECK_COUNT} checks cleared
                    </li>
                  )}

                  {studio.completedProjects < 3 ? (
                    <li>
                      <Flag>Too few finished projects to state a delivery record</Flag>
                    </li>
                  ) : null}
                </ul>

                {match.reasoning.length > 1 ? (
                  <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
                    {match.reasoning.slice(1, 4).map((line) => (
                      <li key={line} className="text-[13px] leading-snug text-[var(--ink2)]">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
