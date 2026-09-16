/**
 * A catalogue element, drawn.
 *
 * Eight forms driven by the catalogue's data rather than forty-six bespoke
 * drawings: adding an element is one line in `catalogue.ts` and nothing here.
 * That matters more than it sounds — a catalogue that is expensive to extend is
 * a catalogue that stops being extended, and this one has to grow every time a
 * studio teaches us a material we did not know about.
 *
 * Fixed hex from the element, not theme tokens, for the same reason
 * `palettes.ts` uses fixed hex: a teak is a teak in dark mode too.
 *
 * Replace with real project photography the moment we have it. A drawing that
 * is honestly a drawing beats a stock photo pretending to be someone's work,
 * but it loses to an actual Pune kitchen at the customer's own budget.
 */

import type { Element, ElementForm } from '@/modules/prepare/catalogue';

export function ElementTile({ element, className = '' }: { element: Element; className?: string }) {
  const [base, accent, line] = element.colours;

  return (
    <svg
      viewBox="0 0 120 90"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={element.label}
    >
      <rect x="0" y="0" width="120" height="90" fill={base} />
      <Form form={element.form} base={base} accent={accent} line={line} />
    </svg>
  );
}

function Form({
  form,
  base,
  accent,
  line,
}: {
  form: ElementForm;
  base: string;
  accent: string;
  line: string;
}) {
  switch (form) {
    /** A material, seen flat. Grain and veining read as texture at tile size. */
    case 'surface':
      return (
        <>
          <rect x="0" y="0" width="120" height="90" fill={accent} opacity="0.35" />
          {[14, 34, 54, 74].map((y) => (
            <path
              key={y}
              d={`M0 ${y} C 26 ${y - 5}, 54 ${y + 6}, 78 ${y - 2} S 112 ${y + 4}, 120 ${y}`}
              stroke={line}
              strokeWidth="1.2"
              fill="none"
              opacity="0.5"
            />
          ))}
          <line x1="0" y1="45" x2="120" y2="45" stroke={line} strokeWidth="0.8" opacity="0.3" />
        </>
      );

    /** A cabinet front, with the handle that dates a kitchen faster than anything. */
    case 'shutter':
      return (
        <>
          <rect x="10" y="8" width="46" height="74" rx="2" fill={accent} />
          <rect x="64" y="8" width="46" height="74" rx="2" fill={accent} />
          <line x1="60" y1="8" x2="60" y2="82" stroke={line} strokeWidth="1" opacity="0.6" />
          <rect x="46" y="38" width="4" height="16" rx="2" fill={line} />
          <rect x="70" y="38" width="4" height="16" rx="2" fill={line} />
        </>
      );

    /** Seating, low and in profile. Reads as sofa or bed depending on context. */
    case 'seat':
      return (
        <>
          <rect x="8" y="40" width="104" height="26" rx="4" fill={accent} />
          <rect x="8" y="28" width="104" height="16" rx="4" fill={line} opacity="0.75" />
          <rect x="16" y="34" width="30" height="12" rx="3" fill={base} opacity="0.55" />
          <rect x="74" y="34" width="30" height="12" rx="3" fill={base} opacity="0.55" />
          <rect x="14" y="66" width="5" height="10" fill={line} />
          <rect x="101" y="66" width="5" height="10" fill={line} />
        </>
      );

    case 'table':
      return (
        <>
          <rect x="8" y="36" width="104" height="8" rx="2" fill={accent} />
          <rect x="20" y="44" width="5" height="30" fill={line} />
          <rect x="95" y="44" width="5" height="30" fill={line} />
          <line x1="22" y1="60" x2="98" y2="60" stroke={line} strokeWidth="2.5" opacity="0.6" />
        </>
      );

    case 'light':
      return (
        <>
          <line x1="60" y1="0" x2="60" y2="26" stroke={line} strokeWidth="1.5" />
          <path d="M40 52 L60 26 L80 52 Z" fill={accent} />
          <ellipse cx="60" cy="52" rx="20" ry="4" fill={line} opacity="0.7" />
          {/* The pool of light, which is the actual product being chosen. */}
          <path d="M34 90 L60 56 L86 90 Z" fill={accent} opacity="0.18" />
        </>
      );

    /** A hanging fold. Weave lines are what separate linen from polyester here. */
    case 'textile':
      return (
        <>
          <path d="M0 0 H120 V90 H0 Z" fill={accent} opacity="0.4" />
          {[10, 30, 50, 70, 90, 110].map((x) => (
            <path
              key={x}
              d={`M${x} 0 C ${x - 5} 30, ${x + 5} 60, ${x} 90`}
              stroke={line}
              strokeWidth="1.4"
              fill="none"
              opacity="0.45"
            />
          ))}
        </>
      );

    /** A storage unit, shelves visible. */
    case 'storage':
      return (
        <>
          <rect x="14" y="6" width="92" height="78" rx="2" fill={accent} />
          {[26, 45, 64].map((y) => (
            <line key={y} x1="14" y1={y} x2="106" y2={y} stroke={line} strokeWidth="1.6" />
          ))}
          <line x1="60" y1="6" x2="60" y2="84" stroke={line} strokeWidth="1.2" opacity="0.55" />
          <rect x="24" y="30" width="14" height="11" fill={base} opacity="0.5" />
          <rect x="72" y="49" width="18" height="11" fill={base} opacity="0.5" />
        </>
      );

    /** A wall treatment, seen straight on. */
    case 'feature':
      return (
        <>
          <rect x="0" y="0" width="120" height="90" fill={accent} opacity="0.45" />
          {[12, 39, 66, 93].map((x) => (
            <rect
              key={x}
              x={x}
              y="10"
              width="16"
              height="70"
              rx="1.5"
              fill={base}
              opacity="0.4"
              stroke={line}
              strokeWidth="1"
            />
          ))}
        </>
      );
  }
}
