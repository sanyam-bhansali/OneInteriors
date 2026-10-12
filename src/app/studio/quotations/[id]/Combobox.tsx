'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';

/**
 * A list you can type into.
 *
 * ## Why not a `<select>`, and why not a text box
 *
 * The builder had one of each and both were wrong for what they held. The room
 * field was a `<select>` of the rooms already ON the quotation, with a text box
 * underneath for anything else — which meant that on an empty quotation the
 * select had nothing to show, did not render, and a studio was left typing a
 * room name into an unlabelled box with no idea that "Kitchen" and "Master
 * bedroom" were the names the rest of the software would use. The product
 * field was a text box with results underneath, so it looked like a search
 * field on a page rather than a control with a value.
 *
 * A native `<select>` cannot be filtered, and forty products in one is
 * unusable. A text box cannot show what is available. This is the control that
 * does both: the full list on open, filtered as you type, and — where the
 * caller allows it — whatever you typed, as a new value.
 *
 * ## Keyboard
 *
 * Down opens and moves, Up moves, Enter takes the highlighted row, Escape
 * closes without changing anything, Tab leaves and commits nothing. The list
 * is `role="listbox"` with `aria-activedescendant` pointing at the highlighted
 * option, so a screen reader announces the row as it moves rather than
 * announcing nothing, which is what a div full of buttons does.
 *
 * ## The blur delay, and why it is not a hack
 *
 * A click on an option fires `blur` on the input first. Closing on blur
 * immediately would unmount the option before its own click handler ran, so
 * the press would do nothing — the classic "I clicked it and nothing
 * happened" bug. `onMouseDown` with `preventDefault` keeps focus on the input
 * instead, which is the fix rather than a timeout, and is why there is no
 * `setTimeout` here.
 */

export interface ComboOption {
  /** What is stored. For a product this is its id; for a room, the name. */
  value: string;
  /** What is read. */
  label: string;
  /** Right-aligned, quiet — a rate, a count, a warning. */
  hint?: string;
  /** Draws the hint in the warning colour. A product with no rate, say. */
  hintWarns?: boolean;
}

export function Combobox({
  label,
  value,
  options,
  placeholder,
  onChange,
  allowCustom = false,
  customHint,
  emptyNote,
  autoFocus,
}: {
  label: string;
  /** The current value, or '' for none. */
  value: string;
  options: ComboOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  /** May the studio commit something that is not on the list? */
  allowCustom?: boolean;
  /** How the "use what I typed" row reads. Takes the typed text. */
  customHint?: (typed: string) => string;
  /** Shown when the filter matches nothing and custom values are not allowed. */
  emptyNote?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? null;

  /* While closed the input shows the CHOSEN label; while open it shows what
     is being typed. Without that split, opening the list would either wipe
     the current value or filter the list down to the one thing already
     chosen. */
  const text = open ? query : (selected?.label ?? value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!open || q === '') return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [open, options, query]);

  const typed = query.trim();
  const canAddTyped =
    allowCustom &&
    typed !== '' &&
    !options.some((o) => o.label.toLowerCase() === typed.toLowerCase());

  /** The custom row sits after the matches, so its index is their length. */
  const rowCount = matches.length + (canAddTyped ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  function commit(index: number) {
    if (canAddTyped && index === matches.length) {
      onChange(typed);
    } else {
      const option = matches[index];
      if (!option) return;
      onChange(option.value);
    }
    setOpen(false);
    setQuery('');
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      setActive((a) => (rowCount === 0 ? 0 : (a + 1) % rowCount));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (rowCount === 0 ? 0 : (a - 1 + rowCount) % rowCount));
      return;
    }
    if (e.key === 'Enter' && open) {
      e.preventDefault();
      commit(active);
      return;
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      /* Closes without changing anything — the value it had is the value it
         keeps. Anything else makes Escape a destructive key. */
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div ref={box} className="qfield" style={{ position: 'relative' }}>
      <span className="lbl">{label}</span>

      <div style={{ position: 'relative' }}>
        <input
          value={text}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rowCount > 0 ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
            setActive(0);
          }}
          onKeyDown={onKey}
          className="fld"
          style={{ paddingRight: 34 }}
        />
        <ChevronDown
          size={15}
          strokeWidth={2}
          absoluteStrokeWidth
          aria-hidden
          className="muted"
          style={{ position: 'absolute', right: 12, top: '50%', pointerEvents: 'none', transition: 'transform .2s', transform: `translateY(-50%)${open ? ' rotate(180deg)' : ''}` }}
        />
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="pick float"
        >
          {matches.map((o, i) => (
            <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                /* Keeps focus on the input so the press lands before any blur
                   can unmount this row. See the note at the top. */
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(i)}
                data-active={i === active}
                style={{ display: 'flex', alignItems: 'baseline' }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{o.label}</span>
                {o.hint ? (
                  <span
                    className={`mono sm ${o.hintWarns ? 'warn-t' : 'muted'}`}
                  >
                    {o.hint}
                  </span>
                ) : null}
                {o.value === value ? (
                  <Check size={13} strokeWidth={2.5} absoluteStrokeWidth className="acc-t" />
                ) : null}
              </button>
            </li>
          ))}

          {canAddTyped ? (
            <li id={`${listId}-${matches.length}`} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(matches.length)}
                onClick={() => commit(matches.length)}
                data-active={active === matches.length}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <Plus size={13} strokeWidth={2.5} absoluteStrokeWidth className="acc-t" />
                <span style={{ minWidth: 0 }}>
                  {customHint ? customHint(typed) : `Use “${typed}”`}
                </span>
              </button>
            </li>
          ) : null}

          {rowCount === 0 ? (
            <li className="muted sm" style={{ padding: '10px 14px', lineHeight: 1.5 }}>
              {emptyNote ?? 'Nothing matches that.'}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
