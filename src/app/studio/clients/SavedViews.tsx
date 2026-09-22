'use client';

import { useState, useTransition } from 'react';
import type { SavedView } from '@/modules/studio-practice/saved-views';
import { describe, isEmpty, type ViewFilters } from '@/modules/studio-practice/view-filters';
import { saveViewAction, setDefaultViewAction, deleteViewAction } from './view-actions';

/**
 * Saved filters, as a row of chips above the board.
 *
 * ## Chips, not a dropdown
 *
 * A view exists to be one click away — that is the entire reason to save one
 * rather than re-picking two filters. Putting them behind a select adds back
 * the click the feature was meant to remove, and hides from a studio that
 * they have any.
 *
 * ## The star, and why the default is not just "the first one"
 *
 * A board that opens on nothing means re-applying your filter every morning.
 * A board that opens on whichever view sorted first means the order of a list
 * silently decides what you see. So one view is explicitly starred, at most
 * one, and the store enforces that in a transaction.
 *
 * ## Saving is only offered when there is something to save
 *
 * An unfiltered board has no view worth naming, and "Save this view" beside a
 * board showing everything is a button that produces a view called "Mine"
 * which shows everything. So the control appears only once a filter is on.
 */
export function SavedViews({
  views,
  current,
  onApply,
  memberName,
}: {
  views: SavedView[];
  /** What the board is filtered by right now. */
  current: ViewFilters;
  onApply: (filters: ViewFilters) => void;
  /** For describing a view that points at a person. */
  memberName: (id: string) => string | null;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const canSave = !isEmpty(current);

  /* Compared by value, so applying a saved view lights its own chip and
     changing one filter afterwards un-lights it. Key order does not matter
     because `cleanFilters` writes them in a fixed order on both sides. */
  const activeId = views.find((v) => same(v.filters, current))?.id ?? null;

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string } | { idle: true }>) {
    setError(null);
    start(async () => {
      const result = await fn();
      if ('error' in result) setError(result.error);
      else {
        setNaming(false);
        setName('');
      }
    });
  }

  if (views.length === 0 && !canSave) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {views.length > 0 ? <span className="s-label">Views</span> : null}

        {views.map((v) => (
          <span
            key={v.id}
            className={`inline-flex items-center rounded-full border text-[13px] transition-colors ${
              activeId === v.id
                ? 'border-[var(--s-accent)] bg-[var(--s-accent)]/10'
                : 'border-[var(--s-rule)] hover:border-[var(--s-ink-3)]'
            }`}
          >
            <button
              type="button"
              onClick={() => onApply(v.filters)}
              title={describe(v.filters, memberName)}
              className="py-1 pl-3 pr-1.5"
            >
              {v.isDefault ? (
                <span aria-label="Opens by default" className="mr-1 text-[var(--s-accent)]">
                  ★
                </span>
              ) : null}
              {v.name}
            </button>

            {/* Star and delete are separate buttons inside the chip rather
                than a menu: two actions do not earn a menu, and a menu here
                would mean two clicks to do the thing the chip exists for. */}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setDefaultViewAction(v.isDefault ? null : v.id))}
              title={v.isDefault ? 'Stop opening with this' : 'Open the board with this'}
              className="px-1 text-[var(--s-ink-3)] hover:text-[var(--s-accent)] disabled:opacity-50"
            >
              <span className="sr-only">
                {v.isDefault ? `Stop opening with ${v.name}` : `Open the board with ${v.name}`}
              </span>
              {v.isDefault ? '☆' : '★'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteViewAction(v.id))}
              className="pr-2.5 pl-0.5 text-[var(--s-ink-3)] hover:text-[var(--s-danger,#98371f)] disabled:opacity-50"
            >
              <span className="sr-only">Delete the view {v.name}</span>×
            </button>
          </span>
        ))}

        {canSave && !naming ? (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="rounded-full border border-dashed border-[var(--s-rule)] px-3 py-1 text-[13px] text-[var(--s-ink-2)] hover:border-[var(--s-ink-3)]"
          >
            + Save this view
          </button>
        ) : null}
      </div>

      {naming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveViewAction(name, current));
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={40}
            placeholder={describe(current, memberName)}
            className="rounded-[8px] border border-[var(--s-rule)] bg-transparent px-3 py-1.5 text-[13.5px]"
          />
          <button
            type="submit"
            disabled={pending || name.trim().length < 2}
            className="rounded-[8px] bg-[var(--s-accent)] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setNaming(false);
              setName('');
              setError(null);
            }}
            className="text-[13px] text-[var(--s-ink-3)] hover:text-[var(--s-ink)]"
          >
            Cancel
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="m-0 text-[13px] text-[var(--s-danger,#98371f)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Two filter sets that would show the same board.
 *
 * Compared key by key rather than by `JSON.stringify`, which would call two
 * identical views different because one was written before the other key
 * existed.
 */
function same(a: ViewFilters, b: ViewFilters): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (a[k as keyof ViewFilters] !== b[k as keyof ViewFilters]) return false;
  }
  return true;
}
