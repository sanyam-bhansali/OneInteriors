'use client';

/**
 * "Your home, assembling" (build queue item 26): the brief's side panel as a
 * picture of their home rather than a list. The rooms of their configuration
 * appear once they pick one; the rooms in the work fill with the palette of
 * the style they lean to; the household and the keys date are pinned to it.
 * A schematic of a typical layout, like the quote's — never their plan.
 */

import type { Brief } from '@/modules/brief/types';
import { STYLE_PALETTES } from '@/modules/brief/palettes';
import { BEDROOMS } from '@/modules/quotation/estimate';
import { selectionOf, scopeCandidates } from '@/modules/quotation/scope';
import { monthLabel } from '@/modules/brief/possession';
import { useSiteT } from '@/components/app/i18n';
import { OI_DICT } from '@/modules/i18n/site/oi';

const NEUTRAL = { wall: '#ECE8E1', floor: '#D8D1C5', accent: '#8C8A84' };

export function HomeSketch({ brief }: { brief: Brief }) {
  const t = useSiteT(OI_DICT);
  if (!brief.propertyType) {
    return (
      <p className="m-0 text-[13px] text-[var(--ink2)]">{t('sketch.empty')}</p>
    );
  }
  const bhk = BEDROOMS[brief.propertyType];
  const palette = brief.styleLikes[0] ? STYLE_PALETTES[brief.styleLikes[0]] : null;
  const fill = palette ?? NEUTRAL;
  const inWork = new Set(brief.scope ? scopeCandidates(bhk, selectionOf(brief)).map((i) => i.room) : []);
  const rooms: { key: string; label: string; x: number; y: number; w: number; h: number }[] = [
    { key: 'MASTER_BEDROOM', label: t('sketch.master'), x: 0, y: 0, w: 40, h: 34 },
    ...(bhk >= 2 ? [{ key: 'SECOND_BEDROOM', label: t('sketch.bed2'), x: 0, y: 34, w: 40, h: 30 }] : []),
    ...(bhk >= 3 ? [{ key: 'THIRD_BEDROOM', label: t('sketch.bed3'), x: 0, y: 64, w: 40, h: 36 }] : []),
    { key: 'LIVING_DINING', label: t('sketch.living'), x: 40, y: 0, w: 60, h: 62 },
    { key: 'BATHROOMS', label: t('sketch.bath'), x: 40, y: 62, w: 24, h: 38 },
    { key: 'KITCHEN', label: t('sketch.kitchen'), x: 64, y: 62, w: 36, h: 38 },
  ];
  const h = brief.household;
  const people = h
    ? [
        t(h.adults === 1 ? 'sketch.adult' : 'sketch.adults', { n: h.adults }),
        h.children ? t(h.children === 1 ? 'sketch.child' : 'sketch.children', { n: h.children }) : null,
        h.elderly ? t('sketch.elderly', { n: h.elderly }) : null,
        h.pets ? t('sketch.pets') : null,
        h.worksFromHome ? t('sketch.wfh') : null,
      ].filter(Boolean)
    : [];
  const keys =
    brief.possessionStatus === 'HAVE_KEYS'
      ? t('sketch.keysInHand')
      : brief.possessionStatus === 'EXPECTED'
        ? monthLabel(brief.possessionOn)
          ? t('sketch.keysOn', { month: monthLabel(brief.possessionOn)! })
          : t('sketch.keysExpected')
        : null;

  return (
    <figure className="m-0">
      <svg viewBox="0 0 100 100" className="block w-full" role="img" aria-label={t('sketch.aria', { bhk })}>
        {rooms.map((r) => {
          const on = !brief.scope || inWork.has(r.key as never);
          return (
            <g key={r.key}>
              <rect
                x={r.x + 0.6}
                y={r.y + 0.6}
                width={r.w - 1.2}
                height={r.h - 1.2}
                rx="1.5"
                fill={on ? fill.wall : 'transparent'}
                stroke={on ? fill.accent : '#B9B3A9'}
                strokeWidth="0.6"
                strokeDasharray={on ? undefined : '1.5 1.2'}
                style={{ transition: 'fill 600ms ease' }}
              />
              {on ? <rect x={r.x + 0.6} y={r.y + r.h - 5.5} width={r.w - 1.2} height="4.9" fill={fill.floor} opacity="0.8" /> : null}
              <text x={r.x + 2.5} y={r.y + 6} fontSize="3.6" fill="#3D3A36" fontFamily="inherit">
                {r.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-1.5">
        {palette ? (
          <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11.5px] text-[var(--ink2)]">
            {palette.materials.join(' · ')}
          </span>
        ) : null}
        {people.length > 0 ? (
          <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11.5px] text-[var(--ink2)]">{people.join(', ')}</span>
        ) : null}
        {keys ? (
          <span className="rounded-full border border-[var(--acc)] px-2 py-0.5 text-[11.5px] text-[var(--acc-ink)]">{keys}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}
