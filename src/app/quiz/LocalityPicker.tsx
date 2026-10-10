'use client';

/**
 * Where the home is — a search, not a wall of chips.
 *
 * ## Why it changed
 *
 * The first screen of the brief showed all 64 localities as chips in one wrap.
 * On a phone that made the screen 3.3 viewports tall, with Continue greyed out
 * until you found your area somewhere below the fold — the exact shape of a
 * first screen people leave. The zone grouping already existed
 * (`LOCALITIES_BY_ZONE`) and was being flattened away.
 *
 * Now: type and the list narrows to what matches, or open your part of the
 * city and pick from a dozen. Once chosen, it collapses to one line with a way
 * to change it.
 */

import { useMemo, useState } from 'react';
import {
  LOCALITIES_BY_ZONE,
  PUNE_LOCALITIES,
  zoneOf,
  type PuneZone,
} from '@/modules/brief/types';
import { useLang, useSiteT } from '@/components/app/i18n';
import type { Lang } from '@/modules/i18n/site';
import { ZONE_TX, lbl } from '@/modules/i18n/site/labels';
import { QUIZ_DICT } from '@/modules/i18n/site/quiz';

/** Just the zone's name, without the example areas the full label lists. */
function zoneName(zone: PuneZone, lang: Lang): string {
  return lbl(lang, ZONE_TX, zone).split(' — ')[0]!;
}

/** Lower-case, and the dashes and dots people type differently removed. */
function fold(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function matchingLocalities(query: string, limit = 10) {
  const q = fold(query);
  if (!q) return [];
  const starts = PUNE_LOCALITIES.filter((l) => fold(l.label).startsWith(q));
  const contains = PUNE_LOCALITIES.filter(
    (l) => !fold(l.label).startsWith(q) && (fold(l.label).includes(q) || l.slug.includes(q.replace(/ /g, '-'))),
  );
  return [...starts, ...contains].slice(0, limit);
}

export function LocalityPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (slug: string) => void;
}) {
  const selected = value ? PUNE_LOCALITIES.find((l) => l.slug === value) ?? null : null;
  const [editing, setEditing] = useState(selected === null);
  const [query, setQuery] = useState('');
  const [openZone, setOpenZone] = useState<PuneZone | null>(null);
  const t = useSiteT(QUIZ_DICT);
  const lang = useLang();

  const results = useMemo(() => matchingLocalities(query), [query]);

  function choose(slug: string) {
    onChange(slug);
    setEditing(false);
    setQuery('');
    setOpenZone(null);
  }

  if (selected && !editing) {
    const zone = zoneOf(selected.slug);
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ink)] px-5 text-[15px] font-medium text-white">
          {selected.label}
          {zone ? <span className="font-normal text-white/60">· {zoneName(zone, lang)}</span> : null}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-11 cursor-pointer border-0 bg-transparent px-1 text-[14px] text-[var(--ink-2)] underline underline-offset-2 hover:text-[var(--ink)]"
        >
          {t('loc.change')}
        </button>
      </div>
    );
  }

  const optionClass =
    'flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 border-0 border-b-2 border-[var(--paper)] bg-transparent px-5 py-3 text-left text-[15px] text-[var(--ink)] transition-colors last:border-b-0 hover:bg-[var(--soft-2)]';

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('loc.placeholder')}
        aria-label={t('loc.aria')}
        autoComplete="off"
        className="flow-input placeholder:text-[var(--ink-3)]"
      />

      {query.trim() ? (
        results.length > 0 ? (
          <div className="mt-2 overflow-hidden rounded-[var(--r-m)] bg-[var(--soft)]">
            {results.map((l) => (
              <button key={l.slug} type="button" onClick={() => choose(l.slug)} className={optionClass}>
                <span>{l.label}</span>
                <span className="text-[13px] text-[var(--ink-2)]">{zoneName(l.zone, lang)}</span>
              </button>
            ))}
          </div>
        ) : (
          /* Say what happened and what to do, rather than an empty box. */
          <p className="m-0 mt-3 px-1 text-[14.5px] leading-relaxed text-[var(--ink-2)]">
            {t('loc.none', { q: query.trim() })}
          </p>
        )
      ) : null}

      {!query.trim() || results.length === 0 ? (
        <div className="mt-3 overflow-hidden rounded-[var(--r-m)] bg-[var(--soft)]">
          {LOCALITIES_BY_ZONE.map((group) => {
            const open = openZone === group.zone;
            return (
              <div key={group.zone} className="border-b-2 border-[var(--paper)] last:border-b-0">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenZone(open ? null : group.zone)}
                  className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-5 py-3 text-left text-[15px] text-[var(--ink)] transition-colors hover:bg-[var(--soft-2)]"
                >
                  <span>{lbl(lang, ZONE_TX, group.zone)}</span>
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--paper)] text-[15px] leading-none text-[var(--ink)]"
                  >
                    {open ? '−' : '+'}
                  </span>
                </button>
                {open ? (
                  <div className="flex flex-wrap gap-2 px-5 pb-5">
                    {group.localities.map((l) => (
                      <button
                        key={l.slug}
                        type="button"
                        onClick={() => choose(l.slug)}
                        className="flow-opt !min-h-11 !px-4 !text-[14px]"
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
