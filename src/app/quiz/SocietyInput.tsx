'use client';

/**
 * The society field, with suggestions as they type (build queue item 7).
 *
 * Picking a suggestion stores the building's one spelling and fills the area
 * it is in — "Gera World of Joy" fills Kharadi. Anything typed that is not on
 * the list is kept exactly as typed: the list is a help, never a gate.
 */

import { useMemo, useState } from 'react';
import { localityLabel } from '@/modules/brief/types';
import { searchSocieties } from '@/modules/brief/society';
import type { PuneSociety } from '@/data/pune-societies';
import { useSiteT } from '@/components/app/i18n';
import { QUIZ_DICT } from '@/modules/i18n/site/quiz';

export function SocietyInput({
  value,
  onChange,
  onPick,
}: {
  value: string | null;
  onChange: (society: string) => void;
  /** A suggestion was chosen: its name and area. */
  onPick: (society: PuneSociety) => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useSiteT(QUIZ_DICT);
  const results = useMemo(() => searchSocieties(value ?? ''), [value]);
  const exact = results.length === 1 && results[0]!.name.toLowerCase() === (value ?? '').trim().toLowerCase();
  const show = open && results.length > 0 && !exact;

  return (
    <div className="relative">
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => {
          onChange(e.target.value.slice(0, 80));
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Late enough that a tap on a suggestion lands first.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t('soc.placeholder')}
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls="society-suggestions"
        aria-autocomplete="list"
        className="flow-input placeholder:text-[var(--ink-3)]"
      />
      {show ? (
        <ul
          id="society-suggestions"
          role="listbox"
          className="absolute left-0 right-0 z-20 m-0 mt-2 list-none overflow-hidden rounded-[var(--r-m)] bg-[var(--paper)] p-0 shadow-[0_0_0_1px_var(--line),0_24px_50px_-28px_rgba(11,11,11,0.35)]"
        >
          {results.map((s) => (
            <li key={s.name} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                }}
                className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-5 py-3 text-left text-[15px] text-[var(--ink)] transition-colors hover:bg-[var(--soft)]"
              >
                <span>{s.name}</span>
                <span className="text-[13px] text-[var(--ink-2)]">{localityLabel(s.locality)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
