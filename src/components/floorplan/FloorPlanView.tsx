'use client';

import { useMemo, useState } from 'react';
import type { PlanRoomSize } from '@/modules/brief/types';

/**
 * The client's flat, drawn from the rooms their floor plan was read into:
 * a 2D schematic (room boxes to scale, with sizes) and a simple 3D massing
 * view of the same boxes. Not an architect's drawing — the plan reader gives
 * sizes, not positions — so rooms are laid out in rows, largest first, and
 * the drawing says so.
 *
 * Pure SVG, no 3D library: it prints, and it costs nothing to load.
 */

const FILL: Record<PlanRoomSize['code'], string> = {
  KITCHEN: '#e8d9c4',
  BEDROOM: '#d9e2ea',
  LIVING: '#e3e8d6',
  DINING: '#e3e8d6',
  STUDY: '#e6dcec',
  TOILET: '#d6e8e6',
  BALCONY: '#efeee8',
  UTILITY: '#efeee8',
  OTHER: '#efeee8',
};

const ft = (mm: number) => {
  const inches = Math.round(mm / 25.4);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
};

interface Placed extends PlanRoomSize {
  x: number;
  y: number;
}

/** Rows, largest rooms first, wrapping at about the width of a square of the same area. */
export function layoutRooms(rooms: PlanRoomSize[]): { placed: Placed[]; width: number; depth: number } {
  const sorted = [...rooms].sort((a, b) => b.widthMm * b.depthMm - a.widthMm * a.depthMm);
  const total = sorted.reduce((t, r) => t + r.widthMm * r.depthMm, 0);
  const rowMax = Math.max(Math.sqrt(total) * 1.35, ...sorted.map((r) => r.widthMm));
  const placed: Placed[] = [];
  let x = 0;
  let y = 0;
  let rowDepth = 0;
  let width = 0;
  for (const r of sorted) {
    if (x > 0 && x + r.widthMm > rowMax) {
      x = 0;
      y += rowDepth;
      rowDepth = 0;
    }
    placed.push({ ...r, x, y });
    x += r.widthMm;
    width = Math.max(width, x);
    rowDepth = Math.max(rowDepth, r.depthMm);
  }
  return { placed, width, depth: y + rowDepth };
}

export function FloorPlanView({ rooms, printable = false }: { rooms: PlanRoomSize[]; printable?: boolean }) {
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const { placed, width, depth } = useMemo(() => layoutRooms(rooms), [rooms]);
  if (rooms.length === 0) return null;

  return (
    <figure className="m-0">
      {printable ? null : (
        <div className="mb-2 flex gap-1.5" role="group" aria-label="Floor plan view">
          {(['2d', '3d'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
                view === v ? 'bg-[var(--s-ink,#16181a)] text-white' : 'border border-[var(--s-rule,#d9dbd6)]'
              }`}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      {view === '2d' || printable ? <Plan2D placed={placed} width={width} depth={depth} /> : <Plan3D placed={placed} />}
      <figcaption className="mt-1.5 text-[11px] leading-snug text-[#7b8085]">
        Rooms and sizes as read from the client&rsquo;s floor plan, laid out side by side — not their real arrangement.
      </figcaption>
    </figure>
  );
}

function Plan2D({ placed, width, depth }: { placed: Placed[]; width: number; depth: number }) {
  const pad = 120;
  return (
    <svg viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${depth + 2 * pad}`} className="block h-auto w-full" role="img" aria-label="2D floor plan">
      {placed.map((r, i) => (
        <g key={`${r.name}-${i}`}>
          <rect x={r.x} y={r.y} width={r.widthMm} height={r.depthMm} fill={FILL[r.code]} stroke="#16181a" strokeWidth={40} />
          <text x={r.x + r.widthMm / 2} y={r.y + r.depthMm / 2 - 60} textAnchor="middle" fontSize={Math.min(300, r.widthMm / 7)} fontWeight={600} fill="#16181a">
            {r.name}
          </text>
          <text x={r.x + r.widthMm / 2} y={r.y + r.depthMm / 2 + 260} textAnchor="middle" fontSize={Math.min(240, r.widthMm / 9)} fill="#5d6266">
            {ft(r.widthMm)} × {ft(r.depthMm)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** An isometric massing: each room a low box, drawn back to front. */
function Plan3D({ placed }: { placed: Placed[] }) {
  const wall = 900;
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  const iso = (x: number, y: number, z: number) => [(x - y) * c, (x + y) * s - z] as const;
  const order = [...placed].sort((a, b) => a.x + a.y - (b.x + b.y));
  const pts = placed.flatMap((r) => [
    iso(r.x, r.y, wall),
    iso(r.x + r.widthMm, r.y, 0),
    iso(r.x, r.y + r.depthMm, 0),
    iso(r.x + r.widthMm, r.y + r.depthMm, 0),
  ]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const poly = (p: (readonly [number, number])[]) => p.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <svg viewBox={`${minX - 200} ${minY - 200} ${maxX - minX + 400} ${maxY - minY + 400}`} className="block h-auto w-full" role="img" aria-label="3D view of the rooms">
      {order.map((r, i) => {
        const [x0, y0, x1, y1] = [r.x, r.y, r.x + r.widthMm, r.y + r.depthMm];
        const floor = [iso(x0, y0, 0), iso(x1, y0, 0), iso(x1, y1, 0), iso(x0, y1, 0)];
        const right = [iso(x1, y0, 0), iso(x1, y1, 0), iso(x1, y1, wall), iso(x1, y0, wall)];
        const front = [iso(x0, y1, 0), iso(x1, y1, 0), iso(x1, y1, wall), iso(x0, y1, wall)];
        const [lx, ly] = iso((x0 + x1) / 2, (y0 + y1) / 2, 0);
        return (
          <g key={`${r.name}-${i}`} stroke="#16181a" strokeWidth={22}>
            <polygon points={poly(floor)} fill={FILL[r.code]} />
            <polygon points={poly(right)} fill="#c9ccc6" />
            <polygon points={poly(front)} fill="#dfe1dc" />
            <text x={lx} y={ly} textAnchor="middle" fontSize={Math.min(280, r.widthMm / 7)} fill="#16181a" stroke="none" fontWeight={600}>
              {r.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
