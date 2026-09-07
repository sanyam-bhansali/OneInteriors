/**
 * A room elevation drawn from a style's real material palette.
 *
 * These are the quiz's Q4/Q5 tiles. They have to read as *rooms* — a person
 * picking on instinct is reading proportion, warmth and material, and a grey
 * abstract tile gives them none of that. Drawn rather than photographed
 * because we have no photography yet, and a drawing that is honestly a drawing
 * beats a stock photo pretending to be someone's work.
 */

import { STYLE_PALETTES, type Motif } from '@/modules/brief/palettes';
import type { StyleTag } from '@/modules/brief/types';

export function StyleScene({ tag, className = '' }: { tag: StyleTag; className?: string }) {
  const p = STYLE_PALETTES[tag];

  return (
    <svg
      viewBox="0 0 160 120"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label="Room in this style"
    >
      {/* Wall */}
      <rect x="0" y="0" width="160" height="120" fill={p.wall} />

      {/* Motif-specific back wall treatment */}
      <BackWall motif={p.motif} p={p} />

      {/* Floor */}
      <rect x="0" y="88" width="160" height="32" fill={p.floor} />
      <line x1="0" y1="88" x2="160" y2="88" stroke={p.trim} strokeWidth="1" opacity="0.8" />

      {/* Furniture + accent */}
      <Furniture motif={p.motif} p={p} />
    </svg>
  );
}

function BackWall({ motif, p }: { motif: Motif; p: (typeof STYLE_PALETTES)[StyleTag] }) {
  switch (motif) {
    case 'minimal':
      // Single large window, thin frame
      return (
        <>
          <rect x="92" y="18" width="52" height="60" fill={p.wall} stroke={p.accent} strokeWidth="1.5" />
          <line x1="118" y1="18" x2="118" y2="78" stroke={p.accent} strokeWidth="1" />
          <rect x="94" y="20" width="48" height="56" fill="#FFFFFF" opacity="0.35" />
        </>
      );

    case 'industrial':
      // Crittall grid window + exposed brick band
      return (
        <>
          <rect x="80" y="14" width="68" height="64" fill="#FFFFFF" opacity="0.18" />
          <rect x="80" y="14" width="68" height="64" fill="none" stroke={p.furniture} strokeWidth="2" />
          {[97, 114, 131].map((x) => (
            <line key={x} x1={x} y1="14" x2={x} y2="78" stroke={p.furniture} strokeWidth="1.5" />
          ))}
          {[35, 56].map((y) => (
            <line key={y} x1="80" y1={y} x2="148" y2={y} stroke={p.furniture} strokeWidth="1.5" />
          ))}
          {/* brick course */}
          {[0, 1, 2, 3].map((r) => (
            <g key={r} opacity="0.5">
              <line x1="0" y1={30 + r * 12} x2="66" y2={30 + r * 12} stroke={p.accent} strokeWidth="1" />
            </g>
          ))}
        </>
      );

    case 'ornate':
      // Arched niche with moulding
      return (
        <>
          <path
            d="M92 78 L92 40 A22 22 0 0 1 136 40 L136 78 Z"
            fill={p.accent}
            opacity="0.16"
            stroke={p.accent}
            strokeWidth="1.5"
          />
          <path d="M96 78 L96 42 A18 18 0 0 1 132 42 L132 78" fill="none" stroke={p.trim} strokeWidth="1" />
          {/* cornice */}
          <rect x="0" y="10" width="160" height="4" fill={p.accent} opacity="0.4" />
          <rect x="0" y="16" width="160" height="2" fill={p.trim} opacity="0.5" />
        </>
      );

    case 'deco':
      // Fan / sunburst panelling
      return (
        <>
          <rect x="86" y="16" width="60" height="62" fill={p.furniture} />
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M116 78 L${92 + i * 12} 20`}
              stroke={p.accent}
              strokeWidth="1.2"
              fill="none"
              opacity="0.85"
            />
          ))}
          <circle cx="116" cy="78" r="4" fill={p.accent} />
          <rect x="86" y="16" width="60" height="62" fill="none" stroke={p.accent} strokeWidth="1.5" />
        </>
      );

    case 'organic':
      // Textured plaster + round window
      return (
        <>
          <circle cx="120" cy="42" r="20" fill="#FFFFFF" opacity="0.3" />
          <circle cx="120" cy="42" r="20" fill="none" stroke={p.trim} strokeWidth="2" />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M0 ${24 + i * 20} Q 30 ${18 + i * 20}, 60 ${24 + i * 20}`}
              stroke={p.trim}
              strokeWidth="1"
              fill="none"
              opacity="0.45"
            />
          ))}
        </>
      );

    case 'soft':
    default:
      // Tall casement pair with sheer curtain
      return (
        <>
          <rect x="88" y="16" width="26" height="62" fill="#FFFFFF" opacity="0.32" stroke={p.trim} strokeWidth="1.5" />
          <rect x="120" y="16" width="26" height="62" fill="#FFFFFF" opacity="0.32" stroke={p.trim} strokeWidth="1.5" />
          <rect x="84" y="12" width="8" height="70" fill={p.accent} opacity="0.25" />
          <rect x="142" y="12" width="8" height="70" fill={p.accent} opacity="0.25" />
        </>
      );
  }
}

function Furniture({ motif, p }: { motif: Motif; p: (typeof STYLE_PALETTES)[StyleTag] }) {
  const common = (
    <>
      {/* rug */}
      <ellipse cx="60" cy="104" rx="52" ry="9" fill={p.accent} opacity="0.18" />
    </>
  );

  switch (motif) {
    case 'ornate':
      return (
        <>
          {common}
          {/* carved console */}
          <rect x="16" y="62" width="66" height="8" fill={p.furniture} />
          <rect x="20" y="70" width="5" height="24" fill={p.furniture} />
          <rect x="73" y="70" width="5" height="24" fill={p.furniture} />
          <path d="M25 70 Q49 84, 73 70" stroke={p.accent} strokeWidth="1.5" fill="none" />
          {/* framed art */}
          <rect x="30" y="24" width="34" height="26" fill={p.accent} opacity="0.25" stroke={p.accent} strokeWidth="2" />
          {/* lamp */}
          <rect x="66" y="50" width="3" height="12" fill={p.accent} />
          <path d="M60 50 L75 50 L72 40 L63 40 Z" fill={p.accent} opacity="0.8" />
        </>
      );

    case 'industrial':
      return (
        <>
          {common}
          {/* low leather sofa */}
          <rect x="14" y="64" width="60" height="20" rx="2" fill={p.furniture} />
          <rect x="14" y="58" width="60" height="9" rx="2" fill={p.accent} opacity="0.75" />
          <rect x="18" y="84" width="4" height="6" fill={p.trim} />
          <rect x="66" y="84" width="4" height="6" fill={p.trim} />
          {/* pendant */}
          <line x1="44" y1="0" x2="44" y2="26" stroke={p.furniture} strokeWidth="1.5" />
          <path d="M35 26 L53 26 L49 38 L39 38 Z" fill={p.furniture} />
        </>
      );

    case 'deco':
      return (
        <>
          {common}
          {/* curved velvet sofa */}
          <path d="M14 88 L14 70 Q14 60, 26 60 L62 60 Q74 60, 74 70 L74 88 Z" fill={p.furniture} />
          <path d="M20 88 L20 72 Q20 66, 28 66 L60 66 Q68 66, 68 72 L68 88" fill={p.accent} opacity="0.22" />
          {/* side table */}
          <circle cx="88" cy="80" r="7" fill={p.accent} opacity="0.9" />
          <rect x="87" y="80" width="2" height="10" fill={p.accent} />
        </>
      );

    case 'organic':
      return (
        <>
          {common}
          {/* low timber bench */}
          <rect x="16" y="70" width="62" height="7" rx="3" fill={p.furniture} />
          <rect x="22" y="77" width="5" height="14" fill={p.furniture} />
          <rect x="67" y="77" width="5" height="14" fill={p.furniture} />
          {/* large plant */}
          <path d="M96 92 L100 74 L104 92 Z" fill={p.accent} opacity="0.35" />
          {[-1, 0, 1].map((i) => (
            <path
              key={i}
              d={`M100 76 Q ${100 + i * 14} ${58 - Math.abs(i) * 4}, ${100 + i * 20} ${64 - Math.abs(i) * 2}`}
              stroke={p.accent}
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          ))}
          <ellipse cx="100" cy="92" rx="9" ry="3" fill={p.trim} />
        </>
      );

    case 'minimal':
    case 'soft':
    default:
      return (
        <>
          {common}
          {/* clean sofa */}
          <rect x="14" y="66" width="62" height="18" rx="3" fill={p.furniture} />
          <rect x="14" y="60" width="62" height="8" rx="3" fill={p.furniture} opacity="0.75" />
          <rect x="19" y="84" width="3" height="7" fill={p.trim} />
          <rect x="68" y="84" width="3" height="7" fill={p.trim} />
          {/* cushion */}
          <rect x="22" y="62" width="12" height="10" rx="2" fill={p.accent} opacity="0.85" />
          {/* floor lamp */}
          <line x1="86" y1="88" x2="86" y2="46" stroke={p.trim} strokeWidth="2" />
          <path d="M79 46 L93 46 L90 36 L82 36 Z" fill={p.accent} opacity="0.85" />
          <ellipse cx="86" cy="89" rx="6" ry="2" fill={p.trim} />
        </>
      );
  }
}

/** Three material chips with names. Turns a colour choice into a material choice. */
export function MaterialSwatches({ tag, className = '' }: { tag: StyleTag; className?: string }) {
  const p = STYLE_PALETTES[tag];
  const colours = [p.wall, p.floor, p.accent];
  return (
    <ul className={`m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 ${className}`}>
      {p.materials.map((m, i) => (
        <li key={m} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/15"
            style={{ background: colours[i] }}
            aria-hidden="true"
          />
          <span className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.07em] text-[var(--color-ink-3)]">
            {m}
          </span>
        </li>
      ))}
    </ul>
  );
}
