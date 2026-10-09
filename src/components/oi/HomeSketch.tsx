'use client';

/**
 * "Your home, assembling" (build queue item 26): the brief's side panel as a
 * picture of their home rather than a list.
 *
 * Redrawn 10 Oct 2026 at the owner's request ("it should look like a home…
 * a fully furnished 2D") as a designer's furnished floor plan: walls, doors
 * and windows, and every room furnished — beds, wardrobes, the sofa on its
 * rug, the dining table, an L-shaped kitchen, the bathroom fittings. The
 * rooms in the work take the palette of the style they lean to (floor,
 * wood, fabric, accent); rooms left out stay grey. The number of bedrooms
 * follows their home. A typical layout, like the quote's — never their plan,
 * and the caption says so.
 */

import { useId } from 'react';
import type { Brief } from '@/modules/brief/types';
import { STYLE_PALETTES } from '@/modules/brief/palettes';
import { BEDROOMS } from '@/modules/quotation/estimate';
import { selectionOf, scopeCandidates } from '@/modules/quotation/scope';
import { monthLabel } from '@/modules/brief/possession';
import { useSiteT } from '@/components/app/i18n';
import { OI_DICT } from '@/modules/i18n/site/oi';

interface Paint {
  wall: string;
  floor: string;
  furniture: string;
  accent: string;
  trim: string;
}

const NEUTRAL: Paint = { wall: '#ECE8E1', floor: '#D9CFC0', furniture: '#9A9186', accent: '#8C8A84', trim: '#C9C2B6' };
/** A room left out of the work: drawn, furnished, but quiet. */
const MUTED: Paint = { wall: '#F1EFEB', floor: '#EAE7E2', furniture: '#C9C5BE', accent: '#C9C5BE', trim: '#DEDAD4' };

const INK = '#2C2825';
const FABRIC = '#F7F2EA';
const PAPER = '#FBF9F6';
const GLASS = '#D6E6EC';
const LEAF = '#7E9C6E';
const LEAF_DARK = '#5F7D52';

type Kind = 'bed' | 'living' | 'kitchen' | 'bath' | 'balcony';

interface Room {
  key: string;
  label: string;
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  master?: boolean;
  desk?: boolean;
}

const W = 200;
const H = 140;
const LEFT = 72;
const ROW = 84;

function layout(bhk: number, t: (k: keyof typeof OI_DICT) => string, wfh: boolean): Room[] {
  const left = Math.min(bhk, 3);
  const bedH = H / left;
  const labels = [t('sketch.master'), t('sketch.bed2'), t('sketch.bed3')];
  const keys = ['MASTER_BEDROOM', 'SECOND_BEDROOM', 'THIRD_BEDROOM'];
  const rooms: Room[] = Array.from({ length: left }, (_, i) => ({
    key: keys[i],
    label: labels[i],
    kind: 'bed' as const,
    x: 0,
    y: i * bedH,
    w: LEFT,
    h: bedH,
    master: i === 0,
    // A desk in the second bedroom when someone works from home, and in the
    // only bedroom of a 1 BHK.
    desk: (i === 1 && wfh) || bhk === 1,
  }));
  rooms.push({ key: 'LIVING_DINING', label: t('sketch.living'), kind: 'living', x: LEFT, y: 0, w: W - LEFT, h: ROW });
  if (bhk >= 4) {
    rooms.push({ key: 'KITCHEN', label: t('sketch.kitchen'), kind: 'kitchen', x: LEFT, y: ROW, w: 54, h: H - ROW });
    rooms.push({ key: 'BATHROOMS', label: t('sketch.bath'), kind: 'bath', x: LEFT + 54, y: ROW, w: 28, h: H - ROW });
    rooms.push({ key: 'THIRD_BEDROOM', label: t('sketch.bed4'), kind: 'bed', x: LEFT + 82, y: ROW, w: W - LEFT - 82, h: H - ROW });
  } else {
    rooms.push({ key: 'KITCHEN', label: t('sketch.kitchen'), kind: 'kitchen', x: LEFT, y: ROW, w: 68, h: H - ROW });
    rooms.push({ key: 'BATHROOMS', label: t('sketch.bath'), kind: 'bath', x: LEFT + 68, y: ROW, w: 34, h: H - ROW });
    rooms.push({ key: 'BALCONY', label: t('sketch.balcony'), kind: 'balcony', x: LEFT + 102, y: ROW, w: W - LEFT - 102, h: H - ROW });
  }
  return rooms;
}

// ── Furniture, drawn from above ────────────────────────────────────────

function Plant({ x, y, r = 3.2 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 0.55} fill="#B98C66" />
      <circle cx={x - r * 0.45} cy={y - r * 0.2} r={r * 0.6} fill={LEAF} />
      <circle cx={x + r * 0.45} cy={y - r * 0.3} r={r * 0.55} fill={LEAF_DARK} />
      <circle cx={x} cy={y + r * 0.45} r={r * 0.55} fill={LEAF} />
    </g>
  );
}

function Bedroom({ r, p, on }: { r: Room; p: Paint; on: boolean }) {
  const bw = Math.min(r.w * 0.56, r.master ? 38 : 32);
  const bh = Math.min(r.h * 0.58, r.master ? 30 : 24);
  const bx = r.x + 3.5;
  const by = r.y + (r.h - bh) / 2 - 1;
  const wardrobeH = Math.min(r.h - 10, Math.max(16, r.h * 0.62));
  return (
    <g>
      {r.master && on ? (
        <rect x={bx + bw * 0.35} y={by - 4} width={bw * 0.85} height={bh + 8} rx="1.5" fill={p.accent} opacity="0.16" />
      ) : null}
      {/* Bed: headboard on the wall, mattress, pillows, the turned-down cover */}
      <rect x={bx} y={by} width={bw} height={bh} rx="1.6" fill={p.furniture} />
      <rect x={bx + 2.2} y={by + 1} width={bw - 3.2} height={bh - 2} rx="1.2" fill={FABRIC} />
      <rect x={bx + bw * 0.42} y={by + 1} width={bw * 0.58 - 1} height={bh - 2} rx="1.2" fill={p.accent} opacity={on ? 0.55 : 0.4} />
      <line x1={bx + bw * 0.42} y1={by + 1.5} x2={bx + bw * 0.42} y2={by + bh - 1.5} stroke={FABRIC} strokeWidth="1" />
      <rect x={bx + 3.4} y={by + 2.6} width={bw * 0.18} height={bh / 2 - 3.6} rx="1.2" fill="#fff" stroke={p.trim} strokeWidth="0.3" />
      <rect x={bx + 3.4} y={by + bh / 2 + 1} width={bw * 0.18} height={bh / 2 - 3.6} rx="1.2" fill="#fff" stroke={p.trim} strokeWidth="0.3" />
      {/* Bedside table and lamp */}
      <rect x={bx} y={by - 7.5} width="6.5" height="6" rx="0.8" fill={p.furniture} />
      <circle cx={bx + 3.25} cy={by - 4.5} r="1.6" fill="#F4D99A" stroke={p.trim} strokeWidth="0.3" />
      {/* Wardrobe along the far wall, its doors marked */}
      <rect x={r.x + r.w - 9} y={r.y + 3} width="6.5" height={wardrobeH} fill={p.trim} stroke={p.furniture} strokeWidth="0.5" />
      {Array.from({ length: Math.max(2, Math.floor(wardrobeH / 7)) - 1 }, (_, i) => (
        <line
          key={i}
          x1={r.x + r.w - 9}
          x2={r.x + r.w - 2.5}
          y1={r.y + 3 + ((i + 1) * wardrobeH) / Math.max(2, Math.floor(wardrobeH / 7))}
          y2={r.y + 3 + ((i + 1) * wardrobeH) / Math.max(2, Math.floor(wardrobeH / 7))}
          stroke={p.furniture}
          strokeWidth="0.4"
        />
      ))}
      {r.desk ? (
        <g>
          <rect x={r.x + r.w - 27} y={r.y + r.h - 10} width="15" height="6" rx="0.6" fill={p.furniture} />
          <rect x={r.x + r.w - 24} y={r.y + r.h - 9.3} width="5" height="3.2" rx="0.4" fill="#3A3633" />
          <circle cx={r.x + r.w - 19.5} cy={r.y + r.h - 12.5} r="2.2" fill={p.accent} opacity="0.7" />
        </g>
      ) : (
        <Plant x={r.x + r.w - 15} y={r.y + r.h - 8} r={2.8} />
      )}
    </g>
  );
}

function Living({ r, p, on, mandir }: { r: Room; p: Paint; on: boolean; mandir: boolean }) {
  const x0 = r.x;
  return (
    <g>
      {/* Rug, sofa, coffee table, armchair, TV wall */}
      <rect x={x0 + 9} y="12" width="58" height="38" rx="2.5" fill={p.accent} opacity={on ? 0.2 : 0.12} />
      <rect x={x0 + 13} y="15.5" width="51" height="31" rx="1.8" fill="none" stroke={p.accent} strokeWidth="0.4" opacity="0.45" />
      <rect x={x0 + 12} y="3" width="46" height="4.5" rx="0.6" fill={p.furniture} />
      <rect x={x0 + 26} y="3.6" width="18" height="1.4" rx="0.4" fill="#2F2B28" />
      <rect x={x0 + 11} y="39" width="56" height="12" rx="2.2" fill={p.furniture} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={x0 + 14 + i * 17.4} y="40.2" width="16" height="7.8" rx="1.6" fill={FABRIC} />
      ))}
      <rect x={x0 + 20} y="44" width="5" height="4" rx="1" fill={p.accent} opacity="0.75" />
      <rect x={x0 + 52} y="44" width="5" height="4" rx="1" fill={p.accent} opacity="0.75" />
      <rect x={x0 + 26} y="21" width="26" height="11" rx="5.5" fill={p.trim} stroke={p.furniture} strokeWidth="0.5" />
      <circle cx={x0 + 33} cy="26.5" r="1.6" fill={LEAF} />
      <rect x={x0 + 69} y="18" width="11" height="12" rx="2.4" fill={p.furniture} />
      <rect x={x0 + 70.6} y="19.6" width="7.8" height="8.8" rx="1.8" fill={FABRIC} />
      <Plant x={x0 + 74} y={10} r={3.4} />
      {/* Dining: table, six chairs, a pendant over it */}
      <rect x={x0 + 86} y="36" width="30" height="17" rx="2" fill={p.furniture} />
      <rect x={x0 + 87.5} y="37.5" width="27" height="14" rx="1.4" fill={p.trim} opacity="0.55" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={x0 + 89 + i * 9} y="31" width="6" height="4" rx="1.2" fill={p.furniture} />
          <rect x={x0 + 89 + i * 9} y="54" width="6" height="4" rx="1.2" fill={p.furniture} />
        </g>
      ))}
      <circle cx={x0 + 101} cy="44.5" r="2.4" fill="#F4D99A" opacity="0.9" />
      <Plant x={x0 + 120} y={70} r={3.6} />
      {mandir ? (
        <g>
          <rect x={x0 + 112} y="3" width="11" height="9" rx="0.8" fill={p.furniture} />
          <path d={`M${x0 + 114} 11 V7 a3.5 3.5 0 0 1 7 0 V11 Z`} fill="#E9B44C" opacity="0.9" />
          <circle cx={x0 + 117.5} cy="8.5" r="0.9" fill="#C0582E" />
        </g>
      ) : null}
    </g>
  );
}

function Kitchen({ r, p }: { r: Room; p: Paint }) {
  const { x, y, w, h } = r;
  return (
    <g>
      {/* L-shaped counter: along the left wall and the outer wall */}
      <rect x={x + 2.5} y={y + 2.5} width="9" height={h - 5} fill={p.trim} stroke={p.furniture} strokeWidth="0.5" />
      <rect x={x + 2.5} y={y + h - 11.5} width={w - 5} height="9" fill={p.trim} stroke={p.furniture} strokeWidth="0.5" />
      {/* Hob */}
      <rect x={x + w * 0.42} y={y + h - 10.5} width="13" height="7" rx="0.6" fill="#2F2B28" />
      {[0, 1].map((i) =>
        [0, 1].map((j) => (
          <circle key={`${i}${j}`} cx={x + w * 0.42 + 3.3 + i * 6.4} cy={y + h - 8.8 + j * 3.4} r="1.25" fill="none" stroke="#9A948D" strokeWidth="0.5" />
        )),
      )}
      {/* Sink */}
      <rect x={x + 3.5} y={y + h * 0.3} width="7" height="10" rx="1.4" fill="#E7ECEE" stroke="#9AA6AA" strokeWidth="0.4" />
      <circle cx={x + 7} cy={y + h * 0.3 + 5} r="1" fill="#9AA6AA" />
      {/* Fridge */}
      <rect x={x + w - 12} y={y + 2.5} width="9.5" height="10" rx="0.8" fill="#F5F5F3" stroke="#A8A39C" strokeWidth="0.5" />
      <line x1={x + w - 12} x2={x + w - 2.5} y1={y + 6} y2={y + 6} stroke="#A8A39C" strokeWidth="0.4" />
    </g>
  );
}

function Bath({ r, p }: { r: Room; p: Paint }) {
  const { x, y, w, h } = r;
  return (
    <g>
      {/* Shower, with its glass and drain */}
      <rect x={x + w - 13} y={y + 2.5} width="10.5" height="12" fill="#E3EDF0" />
      <line x1={x + w - 13} y1={y + 2.5} x2={x + w - 13} y2={y + 14.5} stroke="#9AB4BD" strokeWidth="0.6" />
      <circle cx={x + w - 7.75} cy={y + 8.5} r="1" fill="none" stroke="#7F9AA3" strokeWidth="0.5" />
      {/* WC */}
      <rect x={x + 3} y={y + 15} width="4" height="9" rx="0.8" fill="#fff" stroke="#A8A39C" strokeWidth="0.5" />
      <ellipse cx={x + 10.5} cy={y + 19.5} rx="4" ry="3.2" fill="#fff" stroke="#A8A39C" strokeWidth="0.5" />
      {/* Basin on a vanity */}
      <rect x={x + 3} y={y + h - 11} width={Math.min(14, w - 8)} height="8" rx="0.8" fill={p.furniture} opacity="0.85" />
      <ellipse cx={x + 3 + Math.min(14, w - 8) / 2} cy={y + h - 7} rx="3.4" ry="2.4" fill="#fff" stroke="#A8A39C" strokeWidth="0.4" />
    </g>
  );
}

function Balcony({ r }: { r: Room }) {
  const { x, y, w, h } = r;
  return (
    <g>
      <Plant x={x + w / 2} y={y + 10} r={3.6} />
      <Plant x={x + 6} y={y + h - 12} r={3} />
      <circle cx={x + w - 8} cy={y + h - 14} r="4" fill="#C9A886" stroke="#8C6A4A" strokeWidth="0.5" />
    </g>
  );
}

// ── The plan ──────────────────────────────────────────────────────────

export function HomeSketch({ brief }: { brief: Brief }) {
  const t = useSiteT(OI_DICT);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (!brief.propertyType) {
    return <p className="m-0 text-[13px] text-[var(--ink2)]">{t('sketch.empty')}</p>;
  }
  const bhk = BEDROOMS[brief.propertyType];
  const palette = brief.styleLikes[0] ? STYLE_PALETTES[brief.styleLikes[0]] : null;
  const paint: Paint = palette ?? NEUTRAL;
  const inWork = new Set<string>(brief.scope ? scopeCandidates(bhk, selectionOf(brief)).map((i) => i.room) : []);
  const isOn = (key: string) => !brief.scope || key === 'BALCONY' || inWork.has(key) || inWork.has('WHOLE_HOME');
  const rooms = layout(bhk, t, Boolean(brief.household?.worksFromHome));
  const mandir = brief.needs.includes('POOJA_ROOM');

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

  const floorFill = (r: Room, on: boolean) => {
    if (r.kind === 'bath' || r.kind === 'kitchen') return `url(#${uid}-tile${on ? '' : '-m'})`;
    if (r.kind === 'balcony') return `url(#${uid}-deck)`;
    return `url(#${uid}-wood${on ? '' : '-m'})`;
  };

  return (
    <figure className="m-0">
      <svg viewBox={`-3 -3 ${W + 6} ${H + 6}`} className="block w-full" role="img" aria-label={t('sketch.aria', { bhk })}>
        <defs>
          <pattern id={`${uid}-wood`} width="16" height="4.5" patternUnits="userSpaceOnUse">
            <rect width="16" height="4.5" fill={paint.floor} opacity="0.55" />
            <rect width="16" height="4.5" fill={paint.wall} opacity="0.5" />
            <line x1="0" y1="4.4" x2="16" y2="4.4" stroke={paint.floor} strokeWidth="0.35" />
            <line x1="9" y1="0" x2="9" y2="4.5" stroke={paint.floor} strokeWidth="0.3" />
          </pattern>
          <pattern id={`${uid}-wood-m`} width="16" height="4.5" patternUnits="userSpaceOnUse">
            <rect width="16" height="4.5" fill={MUTED.floor} />
            <line x1="0" y1="4.4" x2="16" y2="4.4" stroke="#DCD8D2" strokeWidth="0.35" />
          </pattern>
          <pattern id={`${uid}-tile`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#F2F0EC" />
            <path d="M6 0H0V6" fill="none" stroke="#DAD5CE" strokeWidth="0.35" />
          </pattern>
          <pattern id={`${uid}-tile-m`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill={MUTED.floor} />
            <path d="M6 0H0V6" fill="none" stroke="#DEDAD4" strokeWidth="0.35" />
          </pattern>
          <pattern id={`${uid}-deck`} width="4" height="40" patternUnits="userSpaceOnUse">
            <rect width="4" height="40" fill="#E2D5C2" />
            <line x1="3.8" y1="0" x2="3.8" y2="40" stroke="#CDBDA5" strokeWidth="0.4" />
          </pattern>
        </defs>

        {/* Floors */}
        {rooms.map((r) => (
          <rect key={`f-${r.key}-${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={floorFill(r, isOn(r.key))} />
        ))}

        {/* Furniture */}
        {rooms.map((r) => {
          const on = isOn(r.key);
          const p = on ? paint : MUTED;
          return (
            <g key={`p-${r.key}-${r.x}-${r.y}`} opacity={on ? 1 : 0.75} style={{ transition: 'opacity 600ms ease' }}>
              {r.kind === 'bed' ? <Bedroom r={r} p={p} on={on} /> : null}
              {r.kind === 'living' ? <Living r={r} p={p} on={on} mandir={mandir} /> : null}
              {r.kind === 'kitchen' ? <Kitchen r={r} p={p} /> : null}
              {r.kind === 'bath' ? <Bath r={r} p={p} /> : null}
              {r.kind === 'balcony' ? <Balcony r={r} /> : null}
            </g>
          );
        })}

        {/* Walls: interior, then the outer shell */}
        {rooms.map((r) => (
          <rect
            key={`w-${r.key}-${r.x}-${r.y}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill="none"
            stroke={INK}
            strokeWidth="1.1"
            strokeDasharray={r.kind === 'balcony' ? '1.4 1' : undefined}
          />
        ))}
        <rect x="0" y="0" width={W} height={H} fill="none" stroke={INK} strokeWidth="2.6" />

        {/* Doors: an opening in the wall and the swing of the leaf */}
        {rooms
          .filter((r) => r.kind === 'bed' || r.kind === 'bath' || r.kind === 'kitchen')
          .map((r) => {
            const vertical = r.x === 0; // left-column bedrooms open into the living side
            const s = 9;
            if (vertical) {
              const dx = r.x + r.w;
              const dy = r.y + r.h - s - 4;
              return (
                <g key={`d-${r.key}-${r.y}`}>
                  <rect x={dx - 0.8} y={dy} width="1.6" height={s} fill={PAPER} />
                  <path d={`M${dx} ${dy} L${dx - s} ${dy} A${s} ${s} 0 0 0 ${dx} ${dy + s}`} fill="none" stroke={INK} strokeWidth="0.35" opacity="0.7" />
                </g>
              );
            }
            const dx = r.x + r.w - s - 4;
            const dy = r.y;
            return (
              <g key={`d-${r.key}-${r.x}`}>
                <rect x={dx} y={dy - 0.8} width={s} height="1.6" fill={PAPER} />
                <path d={`M${dx} ${dy} L${dx} ${dy + s} A${s} ${s} 0 0 0 ${dx + s} ${dy}`} fill="none" stroke={INK} strokeWidth="0.35" opacity="0.7" />
              </g>
            );
          })}

        {/* Windows on the outer walls */}
        {rooms
          .filter((r) => r.x === 0)
          .map((r) => (
            <rect key={`win-${r.y}`} x="-1.3" y={r.y + r.h / 2 - 7} width="2.6" height="14" fill={GLASS} stroke={INK} strokeWidth="0.4" />
          ))}
        <rect x={LEFT + 66} y="-1.3" width="26" height="2.6" fill={GLASS} stroke={INK} strokeWidth="0.4" />
        <rect x={W - 1.3} y="16" width="2.6" height="22" fill={GLASS} stroke={INK} strokeWidth="0.4" />
        <rect x={LEFT + 20} y={H - 1.3} width="18" height="2.6" fill={GLASS} stroke={INK} strokeWidth="0.4" />

        {/* Room names */}
        {rooms.map((r) => {
          const tx = r.kind === 'kitchen' ? r.x + 14 : r.x + 3.5;
          const ty = r.kind === 'kitchen' || r.kind === 'bath' ? r.y + 7.5 : r.y + r.h - 3.5;
          return (
            <text
              key={`t-${r.key}-${r.x}-${r.y}`}
              x={tx}
              y={ty}
              fontSize="4.1"
              fontWeight="600"
              letterSpacing="0.15"
              fill={isOn(r.key) ? '#4A443E' : '#A39E97'}
              fontFamily="inherit"
            >
              {r.label}
            </text>
          );
        })}
      </svg>

      <p className="m-0 mt-2 text-[11.5px] leading-snug text-[var(--ink2)]">
        {t('sketch.note', { bhk })}
      </p>
      <figcaption className="mt-2 flex flex-wrap gap-1.5">
        {palette ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-2 py-0.5 text-[11.5px] text-[var(--ink2)]">
            <span className="inline-flex">
              {[palette.wall, palette.floor, palette.furniture, palette.accent].map((c) => (
                <span key={c} className="-ml-0.5 h-2.5 w-2.5 rounded-full border border-white first:ml-0" style={{ background: c }} />
              ))}
            </span>
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
