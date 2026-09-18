'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { FoundClient } from '@/modules/studio-practice/clients';
import { searchAction } from './search-actions';

/**
 * Finding one person.
 *
 * ## Why it does not navigate
 *
 * There is no client detail page, and inventing one just to have somewhere for
 * a search result to go would be worse than this: the four facts somebody
 * wants — whose is it, which column, what is the number — fit in the panel,
 * and the number is tappable. Nothing is lost by staying where you are.
 *
 * ## Why the query is debounced and not submitted
 *
 * Somebody looking up a name mid-phone-call is not going to press Enter. It
 * searches as they type, 250ms behind, and every response carries the query it
 * was for so a slow result for "kot" can never overwrite a fresh one for
 * "kothari".
 */

export function Search() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<FoundClient[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  const query = q.trim();

  useEffect(() => {
    if (query.length < 2) {
      setRows([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    let live = true;

    const timer = setTimeout(async () => {
      try {
        const found = await searchAction(query);
        // `live` is the guard against an out-of-order response: this effect's
        // cleanup runs the moment the query changes, so a reply that arrives
        // for an older query has already been disowned.
        if (live) setRows(found);
      } catch {
        if (live) setRows([]);
      } finally {
        if (live) setSearching(false);
      }
    }, 250);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Close on a click outside, and on Escape — the two things anybody tries.
  useEffect(() => {
    if (!open) return;

    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const showing = open && query.length >= 2;

  return (
    <div ref={box} className="relative px-3 pb-3">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Find a client
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Find a client"
        autoComplete="off"
        // Deliberately NOT a combobox.
        //
        // This carried `aria-expanded` and `aria-controls`, which a search
        // input's implicit role does not support — and the fix is not to add
        // `role="combobox"`. That role promises arrow keys to move through
        // the results and Enter to choose one, and these results are not
        // choosable: there is no client detail page to go to, so the panel
        // is four facts and a phone link, not a listbox.
        //
        // What a screen reader needs here is to be told the count changed,
        // and the live region below does exactly that.
        aria-describedby={`${listId}-count`}
        className="w-full rounded-[9px] border border-[var(--s-rule)] bg-[var(--s-surface)] px-3 py-1.5 text-[13.5px] text-[var(--s-ink)] placeholder:text-[var(--s-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--s-accent)]"
      />

      {/* Live region so a screen reader hears the count change rather than
          having to go looking for a panel that appeared silently. */}
      <p id={`${listId}-count`} className="sr-only" role="status">
        {showing
          ? searching
            ? 'Searching'
            : `${rows.length} ${rows.length === 1 ? 'result' : 'results'}`
          : ''}
      </p>

      {showing ? (
        <div
          id={listId}
          className="s-card absolute left-3 right-3 top-full z-50 max-h-[22rem] overflow-y-auto p-1.5 shadow-xl"
        >
          {rows.length === 0 ? (
            <p className="m-0 px-2.5 py-3 text-[13px] text-[var(--s-ink-3)]">
              {searching ? 'Looking…' : `Nobody matching “${query}”.`}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-0.5 border-b border-[var(--s-rule-soft)] px-2.5 py-2 last:border-b-0"
                >
                  <span className="text-[13.5px] font-medium">{r.name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--s-ink-3)]">
                    <span className="s-tag">{r.stageName}</span>
                    {r.assignedToName ? <span>{r.assignedToName}</span> : <span>Nobody</span>}
                    {r.society ? <span className="truncate">{r.society}</span> : null}
                  </span>
                  {r.phone ? (
                    <a
                      href={`tel:${r.phone}`}
                      className="s-num text-[12.5px] text-[var(--s-accent)] no-underline"
                    >
                      {r.phone}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
