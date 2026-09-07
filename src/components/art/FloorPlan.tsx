/**
 * Hero artwork — a 3BHK plan in the drafting language a studio would actually
 * hand you: poché walls, door swings, dimension strings, room areas in sq ft.
 *
 * It carries real information (a plausible 1,180 sq ft Pune 3BHK), which is the
 * point — the alternative was a stock photograph of someone else's living room.
 *
 * Renders complete at rest. The only motion is a slow ambient sweep, disabled
 * under prefers-reduced-motion.
 */

export function FloorPlan({ className = '' }: { className?: string }) {
  const W = 2.5; // wall thickness

  return (
    <svg
      viewBox="0 0 340 240"
      className={className}
      role="img"
      aria-label="Floor plan of a three-bedroom apartment, 1,180 square feet"
    >
      <defs>
        <linearGradient id="fp-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-petrol)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--color-petrol)" stopOpacity="0.13" />
          <stop offset="100%" stopColor="var(--color-petrol)" stopOpacity="0" />
        </linearGradient>
        <pattern id="fp-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0 L0 0 0 10" fill="none" stroke="var(--color-rule)" strokeWidth="0.4" opacity="0.5" />
        </pattern>
      </defs>

      {/* Drafting grid */}
      <rect x="20" y="18" width="300" height="196" fill="url(#fp-grid)" />

      {/* Room fills */}
      <g opacity="0.5">
        <rect x="20" y="18" width="140" height="104" fill="var(--color-petrol-soft)" />
        <rect x="160" y="18" width="160" height="104" fill="var(--color-paper-3)" />
        <rect x="20" y="122" width="110" height="92" fill="var(--color-paper-3)" />
        <rect x="130" y="122" width="100" height="92" fill="var(--color-brass-soft)" />
        <rect x="230" y="122" width="90" height="92" fill="var(--color-paper-3)" />
      </g>

      {/* Structural walls */}
      <g stroke="var(--color-ink)" strokeWidth={W} fill="none" strokeLinecap="square">
        <rect x="20" y="18" width="300" height="196" />
        <line x1="20" y1="122" x2="320" y2="122" />
        <line x1="160" y1="18" x2="160" y2="122" />
        <line x1="130" y1="122" x2="130" y2="214" />
        <line x1="230" y1="122" x2="230" y2="214" />
      </g>

      {/* Door openings — gaps + swing arcs */}
      <g>
        {/* living -> hall */}
        <line x1="70" y1="122" x2="94" y2="122" stroke="var(--color-paper)" strokeWidth={W + 1} />
        <path d="M70 122 A24 24 0 0 1 70 146" fill="none" stroke="var(--color-ink-3)" strokeWidth="0.9" />
        <line x1="70" y1="122" x2="70" y2="146" stroke="var(--color-ink-3)" strokeWidth="0.9" />

        {/* bed 1 */}
        <line x1="180" y1="122" x2="202" y2="122" stroke="var(--color-paper)" strokeWidth={W + 1} />
        <path d="M180 122 A22 22 0 0 0 180 100" fill="none" stroke="var(--color-ink-3)" strokeWidth="0.9" />
        <line x1="180" y1="122" x2="180" y2="100" stroke="var(--color-ink-3)" strokeWidth="0.9" />

        {/* bed 2 */}
        <line x1="262" y1="122" x2="284" y2="122" stroke="var(--color-paper)" strokeWidth={W + 1} />
        <path d="M262 122 A22 22 0 0 0 262 100" fill="none" stroke="var(--color-ink-3)" strokeWidth="0.9" />
        <line x1="262" y1="122" x2="262" y2="100" stroke="var(--color-ink-3)" strokeWidth="0.9" />
      </g>

      {/* Windows — double line in the wall */}
      <g stroke="var(--color-petrol)" strokeWidth="1.4">
        <line x1="46" y1="18" x2="106" y2="18" />
        <line x1="46" y1="21" x2="106" y2="21" />
        <line x1="200" y1="18" x2="270" y2="18" />
        <line x1="200" y1="21" x2="270" y2="21" />
        <line x1="20" y1="150" x2="20" y2="192" />
        <line x1="23" y1="150" x2="23" y2="192" />
      </g>

      {/* Fixtures — kitchen run + island, drawn thin like a plan */}
      <g stroke="var(--color-ink-2)" strokeWidth="1" fill="none">
        <rect x="136" y="128" width="88" height="12" />
        <rect x="152" y="168" width="56" height="18" rx="1.5" />
        <circle cx="180" cy="134" r="3.4" />
        {/* wardrobes */}
        <rect x="26" y="128" width="10" height="52" />
        <rect x="236" y="128" width="10" height="48" />
        {/* sofa in living */}
        <rect x="40" y="82" width="52" height="16" rx="2" />
        <rect x="104" y="60" width="14" height="34" rx="2" />
      </g>

      {/* Dimension string */}
      <g stroke="var(--color-ink-3)" strokeWidth="0.7">
        <line x1="20" y1="226" x2="320" y2="226" />
        <line x1="20" y1="222" x2="20" y2="230" />
        <line x1="320" y1="222" x2="320" y2="230" />
      </g>
      <text
        x="170"
        y="236"
        textAnchor="middle"
        fill="var(--color-ink-3)"
        fontSize="7"
        fontFamily="var(--font-mono)"
        letterSpacing="0.5"
      >
        11 350 MM
      </text>

      {/* Room labels */}
      <PlanLabel x={90} y={66} name="LIVING" area="286 sq ft" />
      <PlanLabel x={240} y={66} name="MASTER" area="212 sq ft" />
      <PlanLabel x={75} y={172} name="BED 2" area="164 sq ft" />
      <PlanLabel x={180} y={156} name="KITCHEN" area="148 sq ft" />
      <PlanLabel x={275} y={172} name="BED 3" area="138 sq ft" />

      {/* Ambient sweep — the only motion, and it never hides content */}
      <rect x="20" y="18" width="90" height="196" fill="url(#fp-sweep)" className="fp-sweep" />

      <style>{`
        .fp-sweep { animation: fp-move 9s ease-in-out infinite; }
        @keyframes fp-move {
          0%, 100% { transform: translateX(-40px); }
          50%      { transform: translateX(280px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fp-sweep { animation: none; opacity: 0; }
        }
      `}</style>
    </svg>
  );
}

function PlanLabel({ x, y, name, area }: { x: number; y: number; name: string; area: string }) {
  return (
    <g textAnchor="middle" fontFamily="var(--font-mono)">
      <text x={x} y={y} fill="var(--color-ink-2)" fontSize="7.5" letterSpacing="1.2">
        {name}
      </text>
      <text x={x} y={y + 9} fill="var(--color-ink-3)" fontSize="6.5" letterSpacing="0.3">
        {area}
      </text>
    </g>
  );
}
