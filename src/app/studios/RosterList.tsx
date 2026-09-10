'use client';

/**
 * The roster, with filters.
 *
 * ## Why filters at all, on a deliberately small list
 *
 * The page argues that the roster is short on purpose — "that is the whole
 * list" — and a short list does not need searching. But it does need
 * *narrowing*: somebody in Kothrud with ₹6L does not want to read forty
 * profiles to find the four that could work, and the moment the roster passes
 * about a dozen, browsing without filters stops working entirely.
 *
 * ## Why it filters in the browser
 *
 * The whole roster is already on the page — it is small by design and the
 * server sent it. Round-tripping to re-query would make every tap slower for
 * no benefit, and it would put filter state in the URL where it would compete
 * with the shortlist. When the roster is large enough for that trade to
 * reverse, this is the file to change.
 *
 * ## What is deliberately absent
 *
 * No sort control. Order is Proven first, then by delivery record, and it is
 * not for sale — letting a visitor sort by price would quietly make price the
 * organising idea of the page, which is the argument the rest of the product
 * spends its time resisting.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { TierBadge, Pill } from '@/components/ui';
import { PlanFragment } from '@/components/art/PlanFragment';
import { formatINRCompact } from '@/lib/money';
import { PUNE_LOCALITIES, STYLE_LABELS, type StyleTag } from '@/modules/brief/types';
import type { VerificationTier } from '@/modules/studio/types';

/**
 * Only what the list draws.
 *
 * A narrower shape than `Studio` on purpose: everything crossing into a client
 * component is serialised into the page and readable by anyone, so the roster
 * should not carry a studio's whole record just because the list happens to
 * need four fields of it.
 */
export interface RosterEntry {
  id: string;
  slug: string;
  tradeName: string;
  tier: VerificationTier;
  delivery: string;
  localities: string[];
  styleTags: StyleTag[];
  minProjectPaise: number | null;
  maxProjectPaise: number | null;
}

const TIER_OPTIONS: VerificationTier[] = ['PROVEN', 'VERIFIED', 'LISTED'];

export function RosterList({ studios }: { studios: RosterEntry[] }) {
  const [tier, setTier] = useState<VerificationTier | null>(null);
  const [locality, setLocality] = useState<string | null>(null);
  const [style, setStyle] = useState<StyleTag | null>(null);

  // Only offer values that exist. A filter that returns nothing is a dead end
  // the page invited the visitor into.
  const localities = useMemo(() => {
    const present = new Set(studios.flatMap((s) => s.localities));
    return PUNE_LOCALITIES.filter((l) => present.has(l.slug));
  }, [studios]);

  const styles = useMemo(() => {
    const present = new Set(studios.flatMap((s) => s.styleTags));
    return (Object.keys(STYLE_LABELS) as StyleTag[]).filter((t) => present.has(t));
  }, [studios]);

  const shown = useMemo(
    () =>
      studios.filter((s) => {
        if (tier && s.tier !== tier) return false;
        if (locality && !s.localities.includes(locality)) return false;
        if (style && !s.styleTags.includes(style)) return false;
        return true;
      }),
    [studios, tier, locality, style],
  );

  const filtered = tier !== null || locality !== null || style !== null;

  function clear() {
    setTier(null);
    setLocality(null);
    setStyle(null);
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 border-b border-[var(--color-rule)] pb-6">
        <FilterRow label="Verification">
          {TIER_OPTIONS.map((t) => (
            <Chip key={t} active={tier === t} onClick={() => setTier(tier === t ? null : t)}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </Chip>
          ))}
        </FilterRow>

        {localities.length > 1 ? (
          <FilterRow label="Area">
            {localities.map((l) => (
              <Chip
                key={l.slug}
                active={locality === l.slug}
                onClick={() => setLocality(locality === l.slug ? null : l.slug)}
              >
                {l.label}
              </Chip>
            ))}
          </FilterRow>
        ) : null}

        {styles.length > 1 ? (
          <FilterRow label="Style">
            {styles.map((t) => (
              <Chip key={t} active={style === t} onClick={() => setStyle(style === t ? null : t)}>
                {STYLE_LABELS[t]}
              </Chip>
            ))}
          </FilterRow>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <p className="m-0 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-ink-3)]">
            {shown.length} of {studios.length} shown
          </p>
          {filtered ? (
            <button
              type="button"
              onClick={clear}
              className="text-[13.5px] text-[var(--color-petrol)] underline underline-offset-4"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="max-w-[54ch] border-l-2 border-[var(--color-brass)] pl-5">
          <h2 className="h3 mb-2">Nothing on the roster matches that combination.</h2>
          <p className="m-0 mb-4 text-[15px] leading-relaxed text-[var(--color-ink-2)]">
            The roster is small on purpose, so narrow filters run out of studios quickly. That is
            the honest answer rather than a weaker match dressed up as a good one.
          </p>
          <button
            type="button"
            onClick={clear}
            className="text-[14px] text-[var(--color-petrol)] underline underline-offset-4"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
            <li
              key={s.id}
              className="lift flex flex-col border border-[var(--color-rule)] bg-[var(--color-paper-2)]"
            >
              <PlanFragment seed={s.id} styles={s.styleTags} className="block h-28 w-full" />
              <div className="flex flex-1 flex-col gap-3 border-t border-[var(--color-rule)] p-5">
                <div>
                  <h2 className="h3 mb-2">
                    <Link
                      href={`/studios/${s.slug}`}
                      className="text-[var(--color-ink)] no-underline hover:text-[var(--color-petrol)]"
                    >
                      {s.tradeName}
                    </Link>
                  </h2>
                  <TierBadge tier={s.tier} />
                </div>

                <p className="m-0 text-[14px] leading-snug text-[var(--color-ink-2)]">
                  {s.delivery}
                </p>

                <div className="mt-auto flex flex-wrap gap-1.5 border-t border-[var(--color-rule-soft)] pt-3">
                  {s.minProjectPaise && s.maxProjectPaise ? (
                    <Pill>
                      {formatINRCompact(s.minProjectPaise)}–{formatINRCompact(s.maxProjectPaise)}
                    </Pill>
                  ) : null}
                  <Pill>{s.localities.length} areas</Pill>
                </div>

                <p className="m-0 text-[12px] leading-snug text-[var(--color-ink-3)]">
                  {s.localities
                    .map((l) => PUNE_LOCALITIES.find((p) => p.slug === l)?.label ?? l)
                    .join(' · ')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <span className="w-[5.5rem] shrink-0 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.11em] text-[var(--color-ink-3)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors ${
        active
          ? 'border-[var(--color-petrol)] bg-[var(--color-petrol-soft)] text-[var(--color-petrol)]'
          : 'border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-ink-2)] hover:border-[var(--color-ink-3)]'
      }`}
    >
      {children}
    </button>
  );
}
