/**
 * The doodle ground — a tiled field of interior-trade line drawings.
 *
 * ## What it is for
 *
 * A page made of centred text on a flat colour reads as empty however
 * good the words are, because there is nothing for the eye to rest on
 * between one block and the next. This is the same trick WhatsApp uses
 * behind a conversation: a faint, busy, repeating field that makes a
 * plain surface feel like a made thing rather than a blank one.
 *
 * ## Drawn here, not borrowed
 *
 * The objects are ours and they are specific to this trade — a chair, a
 * pendant, a tap, a hinge, a swatch fan, a tile, a roller, a tape. That
 * is deliberate on two counts. WhatsApp's doodle sheet is somebody
 * else's artwork and not ours to copy. And a studio owner glancing at
 * this should see their own working life in the background rather than
 * generic ornament — the pattern is doing a small amount of arguing.
 *
 * ## Why it is one inline SVG and not an image
 *
 * No extra request, no file to lose, and `currentColor` means the whole
 * field is themed by the `color` on the element rather than by exporting
 * a second copy for every ground. It costs about 4 kB of markup, once.
 *
 * ## Legibility comes first
 *
 * The default opacity is deliberately lower than looks right in
 * isolation. Every one of these sits behind text that somebody has to
 * read, and a background that is noticed has already failed. Stroke
 * width stays hairline at every size so it never competes with a rule
 * or a border, both of which are real information.
 */

export function DoodleGround({
  className = '',
  opacity = 0.055,
  scale = 1,
}: {
  /** Set `color` here — every stroke inherits it. */
  className?: string;
  /**
   * Default 0.055, which is below what looks right on its own and about
   * right behind a paragraph. Raise it only on a surface with no text.
   */
  opacity?: number;
  /** Tile scale. Below ~0.8 the drawings stop being readable as objects. */
  scale?: number;
}) {
  const tile = 380 * scale;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ opacity }}
    >
      <defs>
        <pattern
          id="oi-doodle-tile"
          width={tile}
          height={tile}
          patternUnits="userSpaceOnUse"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform={`scale(${scale})`}
          >
            {/* Placed by hand rather than by a loop. A random scatter
                clumps and leaves holes; these are spaced so no two of
                the same object sit near each other across a tile seam,
                which is what makes repetition obvious. */}
            <g transform="translate(24 30) rotate(-8)"><Chair /></g>
            <g transform="translate(150 18) rotate(6)"><Pendant /></g>
            <g transform="translate(252 40) rotate(-5)"><Plant /></g>
            <g transform="translate(320 140) rotate(9)"><Hinge /></g>
            <g transform="translate(40 128) rotate(5)"><Sofa /></g>
            <g transform="translate(178 118) rotate(-7)"><Tap /></g>
            <g transform="translate(272 200) rotate(4)"><Tile /></g>
            <g transform="translate(22 232) rotate(-4)"><Window /></g>
            <g transform="translate(120 224) rotate(8)"><Roller /></g>
            <g transform="translate(206 286) rotate(-6)"><Tape /></g>
            <g transform="translate(310 292) rotate(7)"><Lamp /></g>
            <g transform="translate(62 318) rotate(-9)"><Swatch /></g>
            <g transform="translate(150 336) rotate(5)"><Rug /></g>
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#oi-doodle-tile)" />
    </svg>
  );
}

/* ── The objects ──────────────────────────────────────────────────────
   Each draws from its own origin at roughly 26–46px, so the transforms
   above are positions rather than bounding-box arithmetic. Strokes only,
   no fills — a filled shape at this opacity turns into a smudge. */

function Chair() {
  return <path d="M1 19h24M4 19v14M22 19v14M22 19V2H9v17" />;
}

function Pendant() {
  return (
    <>
      <path d="M15 0v11" />
      <path d="M15 11 3 27h24Z" />
      <path d="M8 31h14" />
    </>
  );
}

function Plant() {
  return (
    <>
      <path d="M7 25h14l-2 11H9Z" />
      <path d="M14 25V10" />
      <path d="M14 16C7 16 5 8 12 7c3 0 4 6 2 9Z" />
      <path d="M14 14c7 0 9-8 2-9-3 0-4 6-2 9Z" />
    </>
  );
}

function Sofa() {
  return (
    <>
      <path d="M3 11h38v11H3Z" />
      <path d="M6 11V5h32v6" />
      <path d="M8 22v3M36 22v3" />
      <path d="M22 11v11" />
    </>
  );
}

function Tap() {
  return (
    <>
      <path d="M6 28V14c0-6 4-9 10-9h4" />
      <path d="M20 5v6" />
      <path d="M2 14h8" />
      <path d="M0 28h16" />
    </>
  );
}

function Tile() {
  return (
    <>
      <path d="M0 0h26v26H0Z" />
      <path d="M0 0l26 26M26 0 0 26" />
    </>
  );
}

function Window() {
  return (
    <>
      <path d="M2 2h26v28H2Z" />
      <path d="M15 2v28M2 16h26" />
    </>
  );
}

function Roller() {
  return (
    <>
      <path d="M2 3h20v9H2Z" />
      <path d="M22 8h4v11h-7" />
      <path d="M19 19v8" />
    </>
  );
}

function Tape() {
  return (
    <>
      <path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z" />
      <path d="M10 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
      <path d="M18 12h12v6H18" />
      <path d="M22 12v6M26 12v6" />
    </>
  );
}

function Lamp() {
  return (
    <>
      <path d="M4 9h18l-3-9H7Z" />
      <path d="M13 9v26" />
      <path d="M6 35h14" />
    </>
  );
}

function Swatch() {
  return (
    <>
      <path d="M2 20 8 2l5 2-6 18Z" />
      <path d="M11 21 14 2l5 1-3 19Z" />
      <path d="M20 21 21 2h5l-1 19Z" />
    </>
  );
}

function Rug() {
  return (
    <>
      <path d="M4 4h34v12H4Z" />
      <path d="M9 4v12M33 4v12" />
      <path d="M4 4V1M11 4V1M18 4V1M25 4V1M32 4V1M38 4V1" />
    </>
  );
}

function Hinge() {
  return (
    <>
      <path d="M2 2h7v24H2ZM13 2h7v24h-7Z" />
      <path d="M11 2v24" />
      <path d="M5 8h1M5 20h1M16 8h1M16 20h1" />
    </>
  );
}
