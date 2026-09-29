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
  ZONE_LABELS,
  zoneOf,
  type PuneZone,
} from '@/modules/brief/types';

/** Just the zone's name, without the example areas the full label lists. */
function zoneName(zone: PuneZone): string {
  return ZONE_LABELS[zone].split(' — ')[0]!;
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
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--acc)] bg-[var(--acc-wash)] px-4 py-2.5 text-[14.5px] text-[var(--ink)]">
          {selected.label}
          {zone ? <span className="text-[var(--ink2)]">· {zoneName(zone)}</span> : null}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] text-[var(--ink2)] underline hover:text-[var(--ink)]"
        >
          Change
        </button>
      </div>
    );
  }

  const optionClass =
    'flex w-full cursor-pointer items-center justify-between gap-3 border-0 border-b border-[var(--line)] bg-transparent px-4 py-3 text-left text-[14.5px] text-[var(--ink)] last:border-b-0 hover:bg-[var(--acc-wash)]';

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Start typing your area — Baner, Wakad, Kharadi…"
        aria-label="Search for your area"
        autoComplete="off"
        className="w-full rounded-full border border-[var(--line)] bg-[var(--card)] px-5 py-3 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink2)]"
      />

      {query.trim() ? (
        results.length > 0 ? (
          <div className="mt-2 overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--card)]">
            {results.map((l) => (
              <button key={l.slug} type="button" onClick={() => choose(l.slug)} className={optionClass}>
                <span>{l.label}</span>
                <span className="text-[13px] text-[var(--ink2)]">{zoneName(l.zone)}</span>
              </button>
            ))}
          </div>
        ) : (
          /* Say what happened and what to do, rather than an empty box. */
          <p className="m-0 mt-3 text-[14px] leading-relaxed text-[var(--ink2)]">
            We do not have &ldquo;{query.trim()}&rdquo; yet. Pick the nearest area from your part of
            the city below — studios are matched by part of the city, so the nearest one works.
          </p>
        )
      ) : null}

      {!query.trim() || results.length === 0 ? (
        <div className="mt-3 overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--card)]">
          {LOCALITIES_BY_ZONE.map((group) => {
            const open = openZone === group.zone;
            return (
              <div key={group.zone} className="border-b border-[var(--line)] last:border-b-0">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenZone(open ? null : group.zone)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-4 py-3 text-left text-[14.5px] text-[var(--ink)]"
                >
                  <span>{group.label}</span>
                  <span aria-hidden="true" className="text-[var(--ink2)]">
                    {open ? '−' : '+'}
                  </span>
                </button>
                {open ? (
                  <div className="flex flex-wrap gap-2 px-4 pb-4">
                    {group.localities.map((l) => (
                      <button
                        key={l.slug}
                        type="button"
                        onClick={() => choose(l.slug)}
                        className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-[14px] text-[var(--ink2)] hover:border-[var(--acc)]"
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
