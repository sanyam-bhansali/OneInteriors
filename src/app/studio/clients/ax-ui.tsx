'use client';

/**
 * Small pieces of the AxLeads look, in our palette (12 Oct 2026): the avatar,
 * the status pills, the source glyph, the stage badge, a menu that closes on
 * an outside click, and the multi-select the filter panel is built from.
 * Shared by the leads list, the board, the pool and the lead page.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { colourOf } from '@/modules/studio-practice/vocabulary';
import { initials } from '@/modules/studio-sales/lead-view';

/* The design's buttons (studio-ui.css): pill buttons, small on toolbars. */
export const btn = 'btn sm';
export const btnOutline = 'btn sec sm';
export const btnPrimary = 'btn pri sm';
export const btnGhost = 'btn ghost sm';

/** The design's avatar: initials on the soft avatar colour. */
export function Avatar({ name, size = 28 }: { name: string | null; size?: number }) {
  const ini = initials(name);
  return (
    <span aria-hidden className="av" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), ...(ini ? {} : { background: 'var(--fill)', color: 'var(--muted)' }) }}>
      {ini ?? '?'}
    </span>
  );
}

/** "Today" — arrived today. */
export const PillToday = () => <span className="chip xs oi">Today</span>;
/** "18d cold". */
export const PillCold = ({ label }: { label: string }) => <span className="chip xs warn">{label}</span>;
/** The next-call badge, coloured by urgency. */
export function PillDue({ bucket, label }: { bucket: string; label: string }) {
  return <span className={`chip xs ${bucket === 'overdue' ? 'bad' : bucket === 'today' ? 'warn' : ''}`}>{label}</span>;
}
/** "#tag". */
export function PillTag({ tag }: { tag: string }) {
  return (
    <span title={tag} className="chip xs tag">
      #{tag}
    </span>
  );
}
export function TagChips({ tags, max = 2 }: { tags: string[]; max?: number }) {
  if (tags.length === 0) return null;
  return (
    <>
      {tags.slice(0, max).map((t) => (
        <PillTag key={t} tag={t} />
      ))}
      {tags.length > max ? <span className="muted" style={{ fontSize: 12 }}>+{tags.length - max}</span> : null}
    </>
  );
}

/** A column's colour dot (the studio's own stage colour). */
export const Dot = ({ colour }: { colour: string }) => <span aria-hidden className="stdot" style={{ background: colourOf(colour).dot }} />;

/** The stage as a chip with its colour dot. */
export function StageBadge({ name, colour }: { name: string; colour: string }) {
  return (
    <span className="chip xs">
      <Dot colour={colour} />
      {name}
    </span>
  );
}

const SOURCE_GLYPH: Record<string, string> = {
  ONE_INTERIORS: 'M12 3.5 3.5 10.5V20h17v-9.5z',
  REFERRAL: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5M16 7.5a2.5 2.5 0 0 1 0 5M18 14.5c1.6.6 2.6 2 2.6 4',
  REPEAT_CLIENT: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
  INSTAGRAM: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17.5 6.5h.01',
  FACEBOOK: 'M14 21v-8h3l.5-3.5H14V7.5c0-1 .4-1.8 1.9-1.8H18V2.6A25 25 0 0 0 15.4 2.5C12.8 2.5 11 4 11 7v2.5H8V13h3v8',
  WEBSITE: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z',
  WALK_IN: 'M13 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM10 21l2-7 3 3v5M8 10l3-3 3 2 3 1M12 14l-1-5',
  ARCHITECT: 'M4 20 12 4l8 16M7 14h10',
  OTHER: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12h.01M12 12h.01M16 12h.01',
};

/** The source as one glyph, its name on hover (AxLeads' mini source chip). */
export function SourceIcon({ source, label }: { source: string; label: string }) {
  return (
    <span title={label} aria-label={label} className="chip xs" style={{ padding: 0, width: 22, justifyContent: 'center' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={SOURCE_GLYPH[source] ?? SOURCE_GLYPH.OTHER} />
      </svg>
    </span>
  );
}

/** Close a popover on an outside click or Escape. */
export function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export interface Opt {
  value: string;
  label: string;
  colour?: string;
}

/** A single choice with a dropdown menu (AxLeads `Select`). */
export function SelectMenu({ value, options, onChange, label, icon, active }: { value: string; options: Opt[]; onChange: (v: string) => void; label?: string; icon?: React.ReactNode; active?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const cur = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="cl-pop">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={active ? btnPrimary : btnOutline}>
        {icon}
        {label ?? cur?.label}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ opacity: 0.6 }}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <ul role="listbox" className="cl-menu">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="cl-mi"
              >
                {o.colour ? <Dot colour={o.colour} /> : null}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                {o.value === value ? <span className="ok">✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Several choices (AxLeads `MultiSelect`): "Stage" until one is picked, then "2 stages". */
export function MultiSelect({ label, values, options, onChange, allLabel }: { label: string; values: string[]; options: Opt[]; onChange: (v: string[]) => void; allLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const on = new Set(values);
  const shown = values.length === 0 ? label : values.length === 1 ? (options.find((o) => o.value === values[0])?.label ?? label).replace(/ \([\d,]+\)$/, '') : `${label} · ${values.length}`;
  return (
    <div ref={ref} className="cl-pop">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={values.length ? btnPrimary : btnOutline}>
        {shown}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ opacity: 0.6 }}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <div role="listbox" aria-multiselectable className="cl-menu" style={{ minWidth: 224 }}>
          <button type="button" onClick={() => onChange([])} className="cl-mi">
            {allLabel}
            {values.length === 0 ? <span className="ok">✓</span> : null}
          </button>
          {options.map((o) => (
            <label key={o.value} className="cl-mi">
              <input
                type="checkbox"
                checked={on.has(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...values, o.value] : values.filter((v) => v !== o.value))}
              />
              {o.colour ? <Dot colour={o.colour} /> : null}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A centred dialog over a scrim (AxLeads `Modal`). */
export function Modal({ onClose, children, width = 'min(560px, 94vw)', labelledBy }: { onClose: () => void; children: React.ReactNode; width?: string; labelledBy?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  /* Drawn at the end of the page (owner, 21 Oct 2026): opened from a list
     row or a board card, a dialog inside the table or the column would be
     clipped by it and sit under its sticky header. Inside `.oi-studio` so it
     keeps the studio's look and theme. */
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => setHost(document.querySelector('.oi-studio') ?? document.body), []);
  const dialog = (
    <div className="overlay" style={{ paddingTop: '12vh' }}>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="cl-sheet" style={{ width, maxWidth: '100%' }}>
        {children}
      </div>
    </div>
  );
  return host ? createPortal(dialog, host) : null;
}
