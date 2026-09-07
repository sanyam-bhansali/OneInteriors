/**
 * Card artwork for a studio, derived deterministically from its id and the
 * styles it actually works in — so a studio's card looks the same every load,
 * and two studios never look alike.
 *
 * Replace with real project photography the moment we have it. Until then this
 * is honest: a drawing that looks like a drawing, in the studio's own palette.
 */

import { STYLE_PALETTES, hashToIndex } from '@/modules/brief/palettes';
import type { StyleTag } from '@/modules/brief/types';

const LAYOUTS = [
  // [ [x,y,w,h] rooms ]
  [
    [0, 0, 58, 62],
    [58, 0, 42, 34],
    [58, 34, 42, 28],
  ],
  [
    [0, 0, 40, 40],
    [40, 0, 60, 62],
    [0, 40, 40, 22],
  ],
  [
    [0, 0, 100, 30],
    [0, 30, 46, 32],
    [46, 30, 54, 32],
  ],
  [
    [0, 0, 34, 62],
    [34, 0, 66, 36],
    [34, 36, 66, 26],
  ],
] as const;

export function PlanFragment({
  seed,
  styles,
  className = '',
}: {
  seed: string;
  styles: StyleTag[];
  className?: string;
}) {
  const layout = LAYOUTS[hashToIndex(seed, LAYOUTS.length)];
  const tag = styles[0] ?? 'contemporary-minimal';
  const p = STYLE_PALETTES[tag];

  // Tints drawn from the studio's own palette rather than a generic ramp.
  const fills = [p.wall, p.floor, p.accent];

  return (
    <svg
      viewBox="0 0 100 62"
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="Plan motif"
    >
      <rect x="0" y="0" width="100" height="62" fill={p.wall} />

      {layout.map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} fill={fills[i % fills.length]} opacity={i === 2 ? 0.4 : 0.85} />
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            fill="none"
            stroke={p.trim}
            strokeWidth="0.8"
            opacity="0.9"
          />
        </g>
      ))}

      {/* A couple of plan fixtures so it reads as a drawing, not a Mondrian */}
      <g stroke={p.furniture} strokeWidth="0.7" fill="none" opacity="0.75">
        <rect x={layout[0][0] + 5} y={layout[0][1] + 6} width={Math.max(10, layout[0][2] - 18)} height="7" rx="1" />
        <circle cx={layout[1][0] + layout[1][2] / 2} cy={layout[1][1] + layout[1][3] / 2} r="4" />
      </g>

      {/* Hatched band — the poché convention */}
      <g stroke={p.accent} strokeWidth="0.5" opacity="0.4">
        {Array.from({ length: 14 }, (_, i) => (
          <line key={i} x1={i * 8} y1="62" x2={i * 8 + 6} y2="55" />
        ))}
      </g>
    </svg>
  );
}
