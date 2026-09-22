'use client';

import { useMemo, useState } from 'react';
import { PUNE_LOCALITIES } from '@/modules/brief/types';

/**
 * Where the studio takes projects.
 *
 * ## Search first, because sixty checkboxes is not a choice
 *
 * The list is every locality we cover. Rendered flat it is a wall somebody
 * scans rather than reads, and the studio picks the four they can see instead
 * of the four they work in — which is the one field the matching engine
 * actually filters on.
 *
 * So: a search box, the selected ones held above it where they cannot scroll
 * away, and a short list of the busiest areas for somebody who does not know
 * what to type. Everything else is behind "Show all", which is the honest
 * shape of a long list — hidden, not absent.
 *
 * ## There is deliberately no "add custom area"
 *
 * The mockup for this screen has one, and it would be a lie. `saveProfile`
 * filters what it receives against `PUNE_LOCALITIES`:
 *
 *     const localities = input.localities.filter((l) =>
 *       PUNE_LOCALITIES.some((p) => p.slug === l),
 *     );
 *
 * A typed-in area would render as a chip, submit, be silently dropped, and
 * the studio would come back later to find it gone with no message — exactly
 * the failure the comment in `ProfileForm` describes as "the label was lying".
 *
 * Making it work is not a UI change either: matching joins on the slug, so a
 * free-text area matches nothing forever. The honest version is a request to
 * us, which needs somewhere to put it. Until then, a search that finds
 * nothing says so and names the nearest thing we do cover.
 */
export function AreaPicker({
  name,
  selected,
  onChange,
  error,
}: {
  name: string;
  selected: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  /* Keyed by `string`, not by the union of known slugs.
     `PUNE_LOCALITIES` is a const array, so inference narrows the key to the
     sixty literal slugs — and then `bySlug.get(slug)` fails to compile,
     because `selected` is string[] and can legitimately hold a slug this
     build does not know about: a locality retired since the studio saved its
     profile, or one added by hand. Widening here rather than casting at the
     call site, so the lookup keeps returning `undefined` for an unknown slug
     and the caller keeps falling back to the raw value. */
  const bySlug = useMemo(
    () => new Map<string, (typeof PUNE_LOCALITIES)[number]>(PUNE_LOCALITIES.map((l) => [l.slug, l])),
    [],
  );

  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (q.length === 0) return [];
    return PUNE_LOCALITIES.filter(
      (l) => l.label.toLowerCase().includes(q) && !selected.includes(l.slug),
    ).slice(0, 12);
  }, [q, selected]);

  /* The unselected remainder, so a chip disappears from the grid the moment
     it moves up to the selected row rather than sitting there looking
     available. */
  const offered = PUNE_LOCALITIES.filter((l) => !selected.includes(l.slug));
  const shown = showAll ? offered : offered.slice(0, 12);

  function toggle(slug: string) {
    onChange(
      selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug],
    );
  }

  return (
    <div>
      {/* The real form values. Checkboxes would work too, but the selected
          row and the grid are two places one value can be shown, and a
          hidden input per selection is the only shape where those two stay
          in step without a controlled checkbox in each. */}
      {selected.map((slug) => (
        <input key={slug} type="hidden" name={name} value={slug} />
      ))}

      {selected.length > 0 ? (
        <ul className="m-0 mb-3 flex list-none flex-wrap gap-2 p-0">
          {selected.map((slug) => (
            <li key={slug}>
              <button
                type="button"
                onClick={() => toggle(slug)}
                className="oi-chip oi-chip-on inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-medium"
              >
                {bySlug.get(slug)?.label ?? slug}
                <span aria-hidden="true" className="text-[15px] leading-none opacity-70">
                  ×
                </span>
                <span className="sr-only">Remove</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]"
        >
          <svg viewBox="0 0 16 16" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="7" cy="7" r="4.6" />
            <path d="M10.4 10.4 L14 14" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search areas — Baner, Wakad, Kharadi…"
          aria-label="Search areas"
          className="oi-input w-full rounded-[11px] border border-[var(--color-rule)] py-2.5 pl-10 pr-4 text-[14.5px]"
        />
      </div>

      {q.length > 0 ? (
        matches.length > 0 ? (
          <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-2 p-0">
            {matches.map((l) => (
              <li key={l.slug}>
                <button
                  type="button"
                  onClick={() => {
                    toggle(l.slug);
                    setQuery('');
                  }}
                  className="oi-chip rounded-full border border-[var(--color-rule)] px-3.5 py-1.5 text-[14px]"
                >
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          /* Named, not blank. "No results" leaves somebody wondering whether
             they misspelled it or we simply do not go there. */
          <p className="m-0 mt-2.5 max-w-[52ch] text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
            Nothing called “{query.trim()}” in the {PUNE_LOCALITIES.length} Pune areas we cover.
            Try the nearest one you would actually drive to — that is what we match on.
          </p>
        )
      ) : (
        <div className="mt-3.5">
          <p className="label m-0 mb-2">{showAll ? 'All areas' : 'Busiest areas'}</p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {shown.map((l) => (
              <li key={l.slug}>
                <button
                  type="button"
                  onClick={() => toggle(l.slug)}
                  className="oi-chip rounded-full border border-[var(--color-rule)] px-3.5 py-1.5 text-[14px] text-[var(--color-ink-2)]"
                >
                  {l.label}
                </button>
              </li>
            ))}

            {!showAll && offered.length > shown.length ? (
              <li>
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="rounded-full px-3 py-1.5 text-[14px] font-medium text-[var(--color-petrol)] hover:underline"
                >
                  Show all {offered.length} →
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      )}

      {error ? (
        <p role="alert" className="m-0 mt-2.5 text-[13.5px] text-[var(--color-atrisk)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
