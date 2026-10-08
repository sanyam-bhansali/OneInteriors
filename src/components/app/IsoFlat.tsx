'use client';

/**
 * The flat as an isometric drawing (the owner's v1 screens, "3D home"),
 * ported from the design file's own script: rooms as floors and low walls,
 * furniture as shaded boxes, and small workers bobbing with a hammer in the
 * rooms in progress. "Finished design" shows every room furnished.
 * Tap a room to select it.
 */

import type { RoomId } from '@/modules/app/example-project';

const S = 20.8;
const T = 12;
const Z = 24;
const OX = 175;
const OY = 46;
const PLY = '#D7B98E';

const P = (x: number, y: number, z: number) => `${(OX + (x - y) * S).toFixed(1)},${(OY + (x + y) * T - z * Z).toFixed(1)}`;

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = c((n >> 16) & 255);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

type Box = [number, number, number, number, number, string];

export interface IsoRoom {
  id: RoomId;
  r: [number, number, number, number];
  today: 'done' | 'progress' | 'next';
  floorD: string;
  floorT: string;
  furnD: Box[];
  furnT: Box[];
}

export const ISO_ROOMS: IsoRoom[] = [
  {
    id: 'living',
    r: [0, 0, 6, 4],
    today: 'next',
    floorD: '#D9B98C',
    floorT: '#ECE8DF',
    furnD: [
      [0.5, 0.5, 3, 1.3, 0.5, '#CFC4B2'],
      [0.8, 1.7, 3.2, 3.2, 0.03, '#E8DCC8'],
      [1.3, 2.0, 2.5, 2.8, 0.3, '#8A5A3C'],
      [5.3, 0.6, 5.8, 3.4, 0.6, '#6B4A33'],
    ],
    furnT: [],
  },
  {
    id: 'bed1',
    r: [6, 0, 10, 4],
    today: 'progress',
    floorD: '#D9B98C',
    floorT: '#E6DCCB',
    furnD: [
      [7, 1, 9.2, 3.2, 0.45, '#E8E2D6'],
      [7, 1, 7.25, 3.2, 0.95, '#8A5A3C'],
      [9.4, 0.3, 9.9, 3.7, 1.6, '#B98B5E'],
    ],
    furnT: [[9.4, 0.3, 9.9, 3.7, 1.6, PLY]],
  },
  {
    id: 'kitchen',
    r: [0, 4, 3, 8],
    today: 'progress',
    floorD: '#E9E2D3',
    floorT: '#E6DCCB',
    furnD: [
      [0.2, 4.2, 0.8, 7.8, 0.7, '#9DAE97'],
      [0.8, 7.2, 2.8, 7.8, 0.7, '#9DAE97'],
    ],
    furnT: [
      [0.2, 4.2, 0.8, 7.8, 0.7, PLY],
      [0.8, 7.2, 2.8, 7.8, 0.7, PLY],
    ],
  },
  {
    id: 'bath',
    r: [3, 4, 6, 8],
    today: 'done',
    floorD: '#D5E0E1',
    floorT: '#D5E0E1',
    furnD: [
      [3.3, 4.3, 4.6, 5.6, 0.12, '#BFD3D6'],
      [5.2, 6.4, 5.8, 7.7, 0.6, '#F3F1EC'],
      [3.3, 7.2, 4.4, 7.8, 0.5, '#E9E6DF'],
    ],
    furnT: [
      [3.3, 4.3, 4.6, 5.6, 0.12, '#BFD3D6'],
      [5.2, 6.4, 5.8, 7.7, 0.6, '#F3F1EC'],
      [3.3, 7.2, 4.4, 7.8, 0.5, '#E9E6DF'],
    ],
  },
  {
    id: 'bed2',
    r: [6, 4, 10, 8],
    today: 'progress',
    floorD: '#D9B98C',
    floorT: '#E6DCCB',
    furnD: [
      [7, 4.8, 9.2, 7, 0.45, '#E8E2D6'],
      [7, 4.8, 7.25, 7, 0.95, '#8A5A3C'],
      [9.4, 4.3, 9.9, 7.7, 1.6, '#B98B5E'],
    ],
    furnT: [[9.4, 4.3, 9.9, 7.7, 1.6, PLY]],
  },
];

interface Shape {
  pts: string;
  fill: string;
  stroke?: string;
  sw?: number;
  dash?: string;
  op?: number;
  room?: RoomId;
}

const WORKERS: [number, number][] = [
  [1.9, 6.2],
  [8.6, 2.2],
  [8.5, 6.1],
];

export function IsoFlat({
  design,
  selected,
  onSelect,
  label,
}: {
  design: boolean;
  selected: RoomId;
  onSelect: (id: RoomId) => void;
  label: string;
}) {
  const shapes: Shape[] = [];
  const add = (pts: string[], fill: string, extra: Omit<Shape, 'pts' | 'fill'> = {}) => shapes.push({ pts: pts.join(' '), fill, ...extra });
  const box = (b: Box, op: number) => {
    const [x0, y0, x1, y1, h, col] = b;
    add([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y1, h)], shade(col, 0.84), { op });
    add([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, h), P(x1, y0, h)], shade(col, 0.72), { op });
    add([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], col, { op });
  };

  const order = [...ISO_ROOMS].sort((a, b) => a.r[0] + a.r[1] - (b.r[0] + b.r[1]));
  for (const rm of order) {
    const [x0, y0, x1, y1] = rm.r;
    const st = design ? 'done' : rm.today;
    const isSel = rm.id === selected;
    const stroke = isSel ? '#BA5329' : st === 'next' ? '#9A988F' : 'rgba(14,14,13,.18)';
    add([P(x0, y0, 0), P(x1, y0, 0), P(x1, y1, 0), P(x0, y1, 0)], design ? rm.floorD : rm.floorT, {
      stroke,
      sw: isSel ? 2.4 : 1,
      dash: st === 'next' && !isSel ? '4 3' : undefined,
      room: rm.id,
    });
    const H = st === 'next' ? 0.5 : 1.2;
    const wop = st === 'next' ? 0.55 : 1;
    add([P(x0, y0, 0), P(x1, y0, 0), P(x1, y0, H), P(x0, y0, H)], '#EFE8DC', { stroke: 'rgba(14,14,13,.14)', sw: 0.8, op: wop, room: rm.id });
    add([P(x0, y0, 0), P(x0, y1, 0), P(x0, y1, H), P(x0, y0, H)], '#E2D9C9', { stroke: 'rgba(14,14,13,.14)', sw: 0.8, op: wop, room: rm.id });
    const furn = [...(design ? rm.furnD : rm.furnT)].sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const f of furn) box(f, !design && f[5] === PLY ? 0.92 : 1);
  }

  return (
    <svg viewBox="0 0 390 280" width="350" height="252" role="img" aria-label={label} className="oa-iso">
      {shapes.map((s, i) => (
        <polygon
          key={i}
          points={s.pts}
          fill={s.fill}
          stroke={s.stroke ?? 'none'}
          strokeWidth={s.sw ?? 0}
          strokeDasharray={s.dash}
          strokeLinejoin="round"
          opacity={s.op ?? 1}
          onClick={s.room ? () => onSelect(s.room!) : undefined}
          style={s.room ? { cursor: 'pointer' } : undefined}
        />
      ))}
      {design
        ? null
        : WORKERS.map(([x, y], i) => (
            <g key={i} transform={`translate(${(OX + (x - y) * S).toFixed(1)} ${(OY + (x + y) * T).toFixed(1)})`}>
              <g className="wk">
                <ellipse cx="0" cy="0" rx="6" ry="2.4" fill="rgba(14,14,13,.18)" />
                <rect x="-3.2" y="-9" width="2.6" height="9" rx="1.2" fill="#3A3F4A" />
                <rect x="0.6" y="-9" width="2.6" height="9" rx="1.2" fill="#3A3F4A" />
                <rect x="-4.6" y="-19" width="9.2" height="11" rx="3" fill="#F2A33A" />
                <rect x="-4.6" y="-14.5" width="9.2" height="1.6" fill="#FFF3D6" />
                <g className="arm">
                  <rect x="3.5" y="-18.5" width="7" height="2.2" rx="1.1" fill="#F2A33A" />
                  <rect x="9.6" y="-21.5" width="2.6" height="6.4" rx=".8" fill="#5A5853" />
                </g>
                <circle cx="0" cy="-22.5" r="3.6" fill="#C08A62" />
                <path d="M-4.6 -23.5 a4.6 4.2 0 0 1 9.2 0 z" fill="#F4C431" />
              </g>
            </g>
          ))}
    </svg>
  );
}
