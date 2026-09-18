/**
 * Fifteen small drawings, one per material.
 *
 * ## Why these exist
 *
 * The glossary used to explain BWP in three paragraphs. A cross-section of a
 * board with a water line at the bottom — one side intact, one delaminating —
 * does it in about a second, and the reader does not have to be in the mood.
 * Somebody choosing a kitchen is excited and on a phone; a picture meets them
 * where they are and an essay does not.
 *
 * ## The rule every drawing obeys
 *
 * **Show the difference, do not decorate the term.** An icon of a plank next
 * to the word "plywood" teaches nothing — it is a label with extra steps.
 * Every drawing here is a comparison or a consequence: the shelf that sags
 * beside the one that does not, the drawer that stops short, the cable with a
 * pipe around it and without. If a drawing could be swapped for any other
 * material's without anybody noticing, it has failed and should be redrawn.
 *
 * ## Why SVG and not photographs
 *
 * Three reasons, in order. A photograph of delaminated ply is ugly at the
 * moment somebody is enjoying themselves. A diagram can show a cross-section,
 * which no photograph can. And these ship as a few hundred bytes each with no
 * licensing to clear — unlike the stock photography elsewhere in this repo,
 * which carries a replace-before-launch note.
 *
 * ## Palette
 *
 * Locked tokens only. Sage is the good side, terracotta the costly one, ink
 * for structure, hairline for anything receding. The two washes are the
 * existing hues at low alpha, not new colours.
 *
 * Every stroke clears 3:1 on whatever it is drawn over, per WCAG 1.4.11 — a
 * diagram carrying information is a graphic, not decoration. That is why a
 * line drawn ON a wash uses the derived ink hue while the same line on plain
 * Alabaster does not need to.
 *
 * Drawn on a 120 × 72 viewBox and scaled by the caller. No text inside the
 * artwork: it would not translate, and it would be unreadable at card size.
 */

const INK = 'var(--ink)';
const LINE = 'var(--line)';
const SEC = 'var(--sec)';
const ACC = 'var(--acc)';
/**
 * The fills sit behind strokes of the same hue, which is inherently the
 * lowest-contrast pairing in the system — at .22 the sage stroke measured
 * 2.63:1 on its own wash and failed 1.4.11. Held at .12, and the strokes that
 * outline a filled shape use the derived ink hues, which clear 4.8:1.
 */
const SEC_WASH = 'rgba(131,144,115,.12)';
const ACC_WASH = 'rgba(192,97,60,.12)';
const SEC_INK = 'var(--sec-ink)';
const ACC_INK = 'var(--acc-ink)';

/** Every drawing shares the frame, the stroke weight and the round joins. */
function Art({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <svg
      viewBox="0 0 120 72"
      role="img"
      aria-label={title}
      className="block h-auto w-full"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** BWP — two board edges standing in water. One holds, one opens up. */
function BoardWater() {
  return (
    <Art title="Two board edges standing in water: one holds together, one swells apart">
      {/* the water */}
      <rect x="2" y="54" width="116" height="16" fill={ACC_WASH} />
      <path d="M2 54h116" stroke={ACC} />

      {/* intact board */}
      <rect x="14" y="16" width="34" height="46" fill={SEC_WASH} stroke={SEC_INK} />
      <path d="M14 30h34M14 44h34" stroke={SEC_INK} strokeWidth={1.2} />

      {/* delaminating board — the plies open where the water is */}
      <path d="M72 16h34v46H72z" stroke={INK} />
      <path d="M72 30h34" stroke={INK} strokeWidth={1.2} />
      <path d="M72 45c6-3 10 3 17 0s11 3 17 0" stroke={ACC} strokeWidth={1.6} />
      <path d="M72 53c6-4 10 4 17 0s11 4 17 0" stroke={ACC} strokeWidth={1.6} />
    </Art>
  );
}

/** BWR — the same board, in a dry room, where it is simply correct. */
function BoardDry() {
  return (
    <Art title="A board in a dry room, intact">
      <rect x="30" y="12" width="60" height="48" fill={SEC_WASH} stroke={SEC_INK} />
      <path d="M30 26h60M30 38h60M30 50h60" stroke={SEC_INK} strokeWidth={1.2} />
      {/* no water line at all — that is the point */}
      <path d="M8 66h104" stroke={LINE} strokeWidth={1.4} />
    </Art>
  );
}

/** MDF — grain telegraphing through paint, against a surface with none. */
function Grain() {
  return (
    <Art title="Grain showing through paint on one panel, none on the other">
      <rect x="10" y="14" width="42" height="46" stroke={INK} />
      <path
        d="M14 24c8-4 14 4 22 0M14 34c8-4 14 4 22 0M14 44c8-4 14 4 22 0M14 54c8-4 14 4 22 0"
        stroke={ACC}
        strokeWidth={1.4}
      />
      <rect x="68" y="14" width="42" height="46" fill={SEC_WASH} stroke={SEC_INK} />
    </Art>
  );
}

/** Particle board — chips in glue. */
function Chips() {
  return (
    <Art title="A board made of glued wood chips">
      <rect x="12" y="18" width="96" height="38" stroke={INK} />
      <g stroke={ACC} strokeWidth={1.4}>
        <path d="M18 26h9M32 24h7M46 28h10M62 25h6M76 27h9M92 24h8" />
        <path d="M20 36h7M34 38h10M50 35h6M64 37h9M80 36h7M94 38h6" />
        <path d="M17 47h10M33 46h6M46 48h9M63 47h7M78 45h8M93 48h7" />
      </g>
    </Art>
  );
}

/** 18mm — one shelf flat, one bowing under the same load. */
function ShelfSag() {
  return (
    <Art title="A thick shelf staying flat and a thin one bowing under the same load">
      {/* uprights */}
      <path d="M10 10v52M56 10v52M64 10v52M110 10v52" stroke={LINE} strokeWidth={1.6} />

      {/* thick, flat */}
      <path d="M10 30h46" stroke={SEC} strokeWidth={5} />
      <rect x="24" y="18" width="18" height="10" fill={SEC_WASH} stroke={SEC_INK} strokeWidth={1.2} />

      {/* thin, bowed */}
      <path d="M64 30q23 12 46 0" stroke={ACC} strokeWidth={2.6} />
      <rect x="78" y="20" width="18" height="10" fill={ACC_WASH} stroke={ACC_INK} strokeWidth={1.2} />
    </Art>
  );
}

/** Laminate — a magnified edge, one worn through to the dark core. */
function LaminateEdge() {
  return (
    <Art title="A magnified board edge: thick skin intact, thin skin worn through to the core">
      {/* thick */}
      <rect x="10" y="20" width="44" height="32" fill="none" stroke={LINE} />
      <path d="M10 20h44" stroke={SEC} strokeWidth={6} />

      {/* thin, worn away in the middle */}
      <rect x="66" y="20" width="44" height="32" fill="none" stroke={LINE} />
      <path d="M66 21h14M96 21h14" stroke={ACC} strokeWidth={3} />
      <path d="M80 26q8-8 16 0" fill={INK} stroke={INK} strokeWidth={1.2} />
    </Art>
  );
}

/** Edge banding — the corner where a thumb opens the shutter, chipped. */
function EdgeChip() {
  return (
    <Art title="A shutter corner: one edge sealed, the other chipped away">
      <path d="M10 62V22a6 6 0 0 1 6-6h34" stroke={SEC} strokeWidth={4} />
      <path d="M16 56V30h28" stroke={LINE} strokeWidth={1.4} />

      <path d="M70 62V22a6 6 0 0 1 6-6h34" stroke={LINE} strokeWidth={1.6} />
      <path d="M70 46V22a6 6 0 0 1 6-6h10" stroke={ACC} strokeWidth={4} />
      <path d="M92 16l6 6-6 4 8 4" stroke={ACC} strokeWidth={1.8} />
    </Art>
  );
}

/** Soft-close — two gauges, one filled three times further round. */
function Cycles() {
  const arc = (frac: number) => {
    const a = -Math.PI / 2 + frac * 2 * Math.PI * 0.75;
    return `${28 + 20 * Math.cos(a)} ${40 + 20 * Math.sin(a)}`;
  };
  return (
    <Art title="Two dials: one filled a quarter of the way, one nearly full">
      <g transform="translate(6,0)">
        <circle cx="28" cy="40" r="20" stroke={LINE} strokeWidth={4} />
        <path d={`M28 20A20 20 0 0 1 ${arc(0.31)}`} stroke={ACC} strokeWidth={4} />
      </g>
      <g transform="translate(58,0)">
        <circle cx="28" cy="40" r="20" stroke={LINE} strokeWidth={4} />
        <path d={`M28 20A20 20 0 1 1 ${arc(1)}`} stroke={SEC} strokeWidth={4} />
      </g>
    </Art>
  );
}

/** Tandem box — one drawer all the way out, one stopping short. */
function Drawer() {
  return (
    <Art title="One drawer pulled fully clear of the cabinet, one stopping short">
      {/* carcass */}
      <rect x="6" y="10" width="34" height="22" stroke={LINE} strokeWidth={1.6} />
      <rect x="6" y="40" width="34" height="22" stroke={LINE} strokeWidth={1.6} />

      {/* full extension */}
      <rect x="44" y="12" width="60" height="18" fill={SEC_WASH} stroke={SEC_INK} />
      <path d="M104 12v18" stroke={SEC} strokeWidth={3} />

      {/* stops short — the gap is the point */}
      <rect x="44" y="42" width="42" height="18" fill={ACC_WASH} stroke={ACC_INK} />
      <path d="M86 42v18" stroke={ACC} strokeWidth={3} />
      <path d="M92 51h18M104 46l6 5-6 5" stroke={ACC} strokeWidth={1.6} />
    </Art>
  );
}

/** Hydraulic — the bed base on its arc, held by a strut. */
function Strut() {
  return (
    <Art title="A bed base lifted on a gas strut">
      <path d="M8 62h104" stroke={LINE} strokeWidth={1.6} />
      <path d="M14 58l52-32" stroke={INK} strokeWidth={4} />
      <path d="M34 58l22-13" stroke={SEC} strokeWidth={3} />
      <circle cx="34" cy="58" r="2.6" fill={SEC} stroke={SEC} />
      <path d="M72 20q16 10 22 30" stroke={LINE} strokeWidth={1.4} strokeDasharray="3 4" />
    </Art>
  );
}

/** False ceiling — the same board on close framing and on wide framing. */
function CeilingGrid() {
  return (
    <Art title="The same ceiling board on close framing and on wide framing">
      <path d="M8 22h46" stroke={SEC} strokeWidth={3} />
      <path d="M12 22v-8M22 22v-8M32 22v-8M42 22v-8M52 22v-8" stroke={SEC} strokeWidth={1.6} />

      <path d="M66 52q22 12 46 0" stroke={ACC} strokeWidth={3} />
      <path d="M68 52V40M110 52V40" stroke={ACC} strokeWidth={1.6} />
      <path d="M86 58v6M92 58v6" stroke={ACC} strokeWidth={1.4} />
    </Art>
  );
}

/** Powder coating — a weld sealed, and a weld bleeding rust. */
function Rust() {
  return (
    <Art title="One welded joint sealed, the other bleeding rust">
      <path d="M12 14v44M12 36h32M44 14v44" stroke={SEC} strokeWidth={4} />
      <path d="M74 14v44M74 36h32M106 14v44" stroke={LINE} strokeWidth={4} />
      <path d="M74 38q-4 8-2 16M74 42q4 8 8 12" stroke={ACC} strokeWidth={2} />
      <circle cx="74" cy="36" r="4" fill={ACC_WASH} stroke={ACC_INK} strokeWidth={1.4} />
    </Art>
  );
}

/** Bevelled mirror — the edge profile, ground back against cut square. */
function Bevel() {
  return (
    <Art title="A ground mirror edge beside a square-cut one">
      <path d="M10 22h44v28H10z" fill={SEC_WASH} stroke={SEC_INK} />
      <path d="M54 22l-10 6v16l10 6" stroke={SEC} strokeWidth={2.4} />

      <path d="M66 22h44v28H66z" stroke={LINE} />
      <path d="M110 22v28" stroke={INK} strokeWidth={2.4} />
      <path d="M110 30l5-3M110 40l5 3" stroke={ACC} strokeWidth={1.8} />
    </Art>
  );
}

/** Paint — the layer stack, with the invisible one missing on the right. */
function Layers() {
  return (
    <Art title="Four paint layers on one wall, the primer missing from the other">
      <g>
        <path d="M10 54h44" stroke={LINE} strokeWidth={5} />
        <path d="M10 45h44" stroke={LINE} strokeWidth={4} />
        <path d="M10 37h44" stroke={SEC} strokeWidth={4} />
        <path d="M10 29h44" stroke={SEC} strokeWidth={4} />
        <path d="M10 21h44" stroke={SEC} strokeWidth={4} />
      </g>
      <g>
        <path d="M66 54h44" stroke={LINE} strokeWidth={5} />
        <path d="M66 45h44" stroke={LINE} strokeWidth={4} />
        <path d="M66 37h44" stroke={ACC} strokeWidth={2} strokeDasharray="4 5" />
        <path d="M66 29h44" stroke={ACC} strokeWidth={4} />
        <path d="M66 21h16M92 21h18" stroke={ACC} strokeWidth={4} />
      </g>
    </Art>
  );
}

/** Conduit — cable you can pull, and cable you cannot. */
function Conduit() {
  return (
    <Art title="Cable inside a pipe, and cable buried straight into plaster">
      <rect x="8" y="18" width="48" height="16" rx="8" fill={SEC_WASH} stroke={SEC_INK} />
      <path d="M14 26h34" stroke={SEC} strokeWidth={2.4} />
      <path d="M48 26h14M56 21l6 5-6 5" stroke={SEC} strokeWidth={1.8} />

      <path d="M68 50q10-6 20 0t20 0" stroke={ACC} strokeWidth={2.4} />
      <g stroke={LINE} strokeWidth={1.4}>
        <path d="M68 42h40M68 58h40M72 42v16M84 42v16M96 42v16M108 42v16" />
      </g>
    </Art>
  );
}

const ART: Record<string, () => React.ReactElement> = {
  'board-water': BoardWater,
  'board-dry': BoardDry,
  grain: Grain,
  chips: Chips,
  'shelf-sag': ShelfSag,
  'laminate-edge': LaminateEdge,
  'edge-chip': EdgeChip,
  cycles: Cycles,
  drawer: Drawer,
  strut: Strut,
  'ceiling-grid': CeilingGrid,
  rust: Rust,
  bevel: Bevel,
  layers: Layers,
  conduit: Conduit,
};

/** Every key the glossary is allowed to reference. Asserted in the tests. */
export const ART_KEYS = Object.keys(ART);

/**
 * The drawing for a material.
 *
 * Returns null for an unknown key rather than throwing — a missing picture
 * should never take a quote screen down — and the test suite makes sure no
 * material can ship with a key that is not here.
 */
export function MaterialArt({ art }: { art: string }) {
  const Drawing = ART[art];
  return Drawing ? <Drawing /> : null;
}
