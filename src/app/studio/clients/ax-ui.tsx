'use client';

/**
 * Small pieces of the AxLeads look, in our palette (12 Oct 2026): the avatar,
 * the status pills, the source glyph, the stage badge, a menu that closes on
 * an outside click, and the multi-select the filter panel is built from.
 * Shared by the leads list, the board, the pool and the lead page.
 */

import { useEffect, useRef, useState } from 'react';
import { colourOf } from '@/modules/studio-practice/vocabulary';
import { avatarColour, initials } from '@/modules/studio-sales/lead-view';

export const btn = 'inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-40';
export const btnOutline = `${btn} border-[var(--s-rule)] bg-[var(--s-surface)] text-[var(--s-ink)] hover:border-[var(--s-ink-3)]`;
export const btnPrimary = `${btn} border-[var(--s-accent)] bg-[var(--s-accent)] text-white hover:bg-[var(--s-accent-deep)]`;
export const btnGhost = `${btn} border-transparent text-[var(--s-ink-2)] hover:bg-[var(--s-rail-active)]`;

export function Avatar({ name, size = 28 }: { name: string | null; size?: number }) {
  const ini = initials(name);
  if (!ini) {
    return (
      <span aria-hidden className="grid flex-none place-items-center rounded-full border border-dashed border-[var(--s-ink-3)] bg-[var(--s-surface-2)] text-[var(--s-ink-3)]" style={{ width: size, height: size, fontSize: size * 0.4 }}>
        ?
      </span>
    );
  }
  return (
    <span aria-hidden className="grid flex-none place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.39, background: avatarColour(name ?? '') }}>
      {ini}
    </span>
  );
}

const PILL = 'inline-flex items-center whitespace-nowrap rounded-full border px-[7px] py-[3px] text-[10.5px] font-semibold leading-none';

/** "Today" — arrived today. */
export const PillToday = () => <span className={`${PILL} border-[var(--s-accent)]/35 bg-[var(--s-accent-wash)] uppercase text-[var(--s-accent)]`}>Today</span>;
/** "18d cold". */
export const PillCold = ({ label }: { label: string }) => <span className={`${PILL} border-[var(--s-warn)]/35 bg-[var(--s-warn-wash)] text-[var(--s-warn)]`}>{label}</span>;
/** The next-call badge, coloured by urgency. */
export function PillDue({ bucket, label }: { bucket: string; label: string }) {
  const tone =
    bucket === 'overdue'
      ? 'border-[var(--s-bad)]/35 bg-[var(--s-bad-wash)] text-[var(--s-bad)]'
      : bucket === 'today'
        ? 'border-[var(--s-warn)]/35 bg-[var(--s-warn-wash)] text-[var(--s-warn)]'
        : 'border-[var(--s-rule)] bg-[var(--s-surface-2)] text-[var(--s-ink-2)]';
  return <span className={`${PILL} ${tone}`}>{label}</span>;
}
/** "#tag". */
export function PillTag({ tag }: { tag: string }) {
  return (
    <span title={tag} className="inline-block max-w-[108px] truncate rounded-full border border-[#7a4fa0]/30 bg-[#7a4fa0]/10 px-2 py-[2px] text-[10.5px] font-semibold leading-[1.35] text-[#6a3f90]">
      <span className="opacity-55">#</span>
      {tag}
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
      {tags.length > max ? <span className="text-[10.5px] font-semibold text-[var(--s-ink-3)]">+{tags.length - max}</span> : null}
    </>
  );
}

/** A column's colour dot. */
export const Dot = ({ colour }: { colour: string }) => <span aria-hidden className="inline-block h-2 w-2 flex-none rounded-full" style={{ background: colourOf(colour).dot }} />;

/** The stage as a coloured chip. */
export function StageBadge({ name, colour }: { name: string; colour: string }) {
  const c = colourOf(colour);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: c.wash, color: c.ink }}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
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
    <span title={label} aria-label={label} className="inline-grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] bg-[var(--s-surface-2)] text-[var(--s-ink-2)]">
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
    <div ref={ref} className="relative inline-flex">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={active ? btnPrimary : btnOutline}>
        {icon}
        {label ?? cur?.label}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="opacity-60">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <ul role="listbox" className="absolute left-0 top-full z-50 mt-1 max-h-[22rem] min-w-[12rem] list-none overflow-y-auto rounded-[10px] border border-[var(--s-rule)] bg-[var(--s-surface)] p-1 shadow-[var(--s-lift)]">
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
                className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[13px] hover:bg-[var(--s-rail-active)]"
              >
                {o.colour ? <Dot colour={o.colour} /> : null}
                <span className="truncate">{o.label}</span>
                {o.value === value ? <span className="ml-auto text-[var(--s-accent)]">✓</span> : null}
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
    <div ref={ref} className="relative inline-flex">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={values.length ? btnPrimary : btnOutline}>
        {shown}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="opacity-60">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <div role="listbox" aria-multiselectable className="absolute left-0 top-full z-50 mt-1 max-h-[22rem] min-w-[14rem] overflow-y-auto rounded-[10px] border border-[var(--s-rule)] bg-[var(--s-surface)] p-1 shadow-[var(--s-lift)]">
          <button type="button" onClick={() => onChange([])} className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[13px] hover:bg-[var(--s-rail-active)]">
            {allLabel}
            {values.length === 0 ? <span className="ml-auto text-[var(--s-accent)]">✓</span> : null}
          </button>
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[13px] hover:bg-[var(--s-rail-active)]">
              <input
                type="checkbox"
                checked={on.has(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...values, o.value] : values.filter((v) => v !== o.value))}
              />
              {o.colour ? <Dot colour={o.colour} /> : null}
              <span className="truncate">{o.label}</span>
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
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[12vh]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} onClick={(e) => e.stopPropagation()} className="flex max-h-[80dvh] flex-col overflow-hidden rounded-[16px] bg-[var(--s-surface)] shadow-[var(--s-lift)]" style={{ width }}>
        {children}
      </div>
    </div>
  );
}
