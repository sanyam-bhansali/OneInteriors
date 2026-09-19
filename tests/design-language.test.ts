import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DUR, STAGGER, STAGGER_CAP, stagger, rise, riseCard, EASE_OUT } from '@/components/oi/motion';

/**
 * The design language, as assertions.
 *
 * docs/DESIGN-LANGUAGE.md makes specific numerical claims — this contrast is
 * 5.02:1, that column sums to exactly 1400px, this delay is capped. A design
 * document whose numbers have quietly stopped being true is worse than no
 * document, because it is still being followed.
 *
 * So the claims live here as well, and the CSS is read from disk rather than
 * restated. If somebody changes a colour or a width and the doc no longer
 * describes the product, this fails.
 */

const ROOT = join(__dirname, '..');
const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');

// ── Contrast ───────────────────────────────────────────────────────

type RGB = [number, number, number];

function hex(h: string): RGB {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB;
}

/** sRGB relative luminance, per WCAG 2.1. */
function luminance([r, g, b]: RGB): number {
  const f = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as RGB;
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(hex(a)), luminance(hex(b))];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Flatten a translucent fill onto its ground.
 *
 * This is the whole reason these numbers are trustworthy — see the doc §4.1.
 * Measuring text against `--card` rather than against `--card` composited
 * over `--bg` is how every one of the failures listed below got shipped in
 * the first place.
 */
function over(fg: string, alpha: number, bg: string): string {
  const [f, b] = [hex(fg), hex(bg)];
  const mix = f.map((v, i) => Math.round(v * alpha + b[i]! * (1 - alpha)));
  return '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const BG = '#EAE6DF'; // Raw Silk
const CARD = '#FCFCFA'; // Alabaster
const INK = '#2C2624';
const INK2 = '#6B615C';

/** The composite ground that text on a match card actually sits on. */
const CARD_GLASS = over(CARD, 0.72, BG);
/** The composite ground under an Apple-glass pill. */
const PILL_GLASS = over('#ffffff', 0.62, BG);

describe('contrast, measured against the composite', () => {
  it('body text on card glass clears AA', () => {
    expect(contrast(INK, CARD_GLASS)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(INK2, CARD_GLASS)).toBeGreaterThanOrEqual(4.5);
  });

  it('the tick clears the 3:1 graphics threshold with room to spare', () => {
    // --ok-ink. The doc claims 5.02:1; hold it to the real threshold plus the
    // margin that made it worth departing from the locked palette at all.
    expect(contrast('#17794a', PILL_GLASS)).toBeGreaterThanOrEqual(4.5);
  });

  it('Muted Sage on pill glass is why --ok-ink exists', () => {
    // 3.11:1 — technically over 3:1, and the reason it was still rejected is
    // that it reads as grey-olive rather than as a tick. If this ever rises
    // above 4.5 the departure is no longer justified and should be revisited.
    expect(contrast('#839073', PILL_GLASS)).toBeLessThan(4.5);
  });

  it('both stops of the CTA gradient carry white text', () => {
    // The LIGHTER stop sets the floor. #c76a44 measured 3.77:1 and failed.
    for (const stop of ['#b05634', '#97462a']) {
      expect(contrast('#ffffff', stop), stop).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('a faded card is still readable, which is why 0.62 was abandoned', () => {
    // At 0.82 over the page: primary and secondary both clear AA. At the
    // original 0.62, secondary computed 2.63:1 — reachable by anyone who
    // simply stopped scrolling with a card near the edge of the band.
    const faded = over(CARD_GLASS, 0.82, BG);
    expect(contrast(INK, faded)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(INK2, faded)).toBeGreaterThanOrEqual(3);
  });

  it('text never sits on glass over artwork', () => {
    /**
     * The studio profile's identity card was over a generated PlanFragment
     * drawing. It looked better and was unshippable: the style palettes run
     * down to #22201E, so at the card's 0.72 alpha the ground under its own
     * secondary text computed 3.87:1 — a fail that appears for some studios
     * and not others, which is the hardest kind to catch by looking.
     *
     * The rule is the alpha floor in §3.2 restated: a translucent surface is
     * only measurable when what is behind it is known. Put art behind text and
     * it stops being known.
     */
    const palette = readFileSync(join(ROOT, 'src/modules/brief/palettes.ts'), 'utf8');
    const darkest = (palette.match(/#[0-9a-fA-F]{6}/g) ?? [])
      .map((h) => h.toLowerCase())
      .reduce((a, b) => (luminance(hex(a)) < luminance(hex(b)) ? a : b));

    const overArt = over(CARD, 0.72, darkest);
    expect(contrast(INK2, overArt), 'card glass over the darkest palette').toBeLessThan(4.5);

    // …which is why the profile keeps the drawing above the card, not behind
    // it. If this ever becomes a negative-margin overlap again, the figure
    // above is what it costs.
    const profile = readFileSync(join(ROOT, 'src/app/studios/[slug]/page.tsx'), 'utf8');
    expect(profile).not.toContain('absolute inset-x-0 top-0 block h-44');
  });

  it('the portfolio stamp clears its worst-case ground, not its average one', () => {
    // It sits ON the artwork, so 0.82 is not enough: 4.06:1 against the
    // darkest palette. 0.92 gives 5.01:1 for every palette in the set.
    expect(css).toContain('background: rgba(252, 252, 250, 0.92)');

    const palette = readFileSync(join(ROOT, 'src/modules/brief/palettes.ts'), 'utf8');
    const darkest = (palette.match(/#[0-9a-fA-F]{6}/g) ?? [])
      .map((h) => h.toLowerCase())
      .reduce((a, b) => (luminance(hex(a)) < luminance(hex(b)) ? a : b));

    expect(contrast(INK2, over(CARD, 0.92, darkest))).toBeGreaterThanOrEqual(4.5);
  });

  it('the derived ink tokens are the ones the CSS actually declares', () => {
    for (const [token, value] of [
      ['--acc-ink', '#964c2f'],
      ['--sec-ink', '#616b55'],
      ['--acc-btn', '#b85d3a'],
      ['--ok-ink', '#17794a'],
    ]) {
      expect(css, `${token} moved — docs/DESIGN-LANGUAGE.md §4.3 lists it`).toContain(
        `${token}: ${value}`,
      );
    }
  });
});

// ── The drawer arithmetic ──────────────────────────────────────────

describe('the margin drawers fit on the screens they are gated to', () => {
  const CARD_W = 640; // 40rem, the card list cap
  const NEAR = { gap: 16, width: 192 }; // .oi-drawer — 12rem
  const FAR = { gap: 12, width: 160 }; // .oi-drawer-far — 10rem

  const nearTotal = CARD_W + 2 * (NEAR.gap + NEAR.width);
  const farTotal = nearTotal + 2 * (FAR.gap + FAR.width);

  it('the inner layer fits inside its 1280px gate', () => {
    expect(nearTotal).toBe(1056);
    expect(nearTotal).toBeLessThanOrEqual(1280);
  });

  it('the outer layer needs exactly 1400px, which is why the gate is 1440', () => {
    expect(farTotal).toBe(1400);
    expect(farTotal).toBeLessThanOrEqual(1440);
  });

  it('the CSS gates match the arithmetic', () => {
    // If somebody widens a column without moving the gate, the page gains a
    // horizontal scrollbar on exactly one class of screen and nowhere else —
    // the kind of bug that survives a whole round of testing.
    expect(css).toContain('@media (min-width: 1280px)');
    expect(css).toContain('@media (min-width: 1440px)');
    expect(css).toContain('width: 12rem');
    expect(css).toContain('width: 10rem');
  });
});

// ── Motion ─────────────────────────────────────────────────────────

describe('the motion vocabulary', () => {
  it('closing is quicker than opening', () => {
    // A drawer that takes as long to shut as it did to open feels stuck.
    expect(DUR.close).toBeLessThan(DUR.open);
    expect(STAGGER.itemClose).toBeLessThan(STAGGER.item);
  });

  it('the card stagger is capped', () => {
    // Uncapped, the ninth card waits 540ms and the list reads as broken.
    expect(stagger(0)).toBe(0);
    expect(stagger(3)).toBeCloseTo(3 * STAGGER.card);
    expect(stagger(20)).toBeCloseTo(STAGGER_CAP * STAGGER.card);
    expect(stagger(20)).toBeLessThanOrEqual(0.35);
  });

  it('nothing overshoots', () => {
    // A curve whose y passes above 1 briefly displays a number that is not
    // true. Both control-point y values must stay at or below 1.
    expect(EASE_OUT[1]).toBeLessThanOrEqual(1);
    expect(EASE_OUT[3]).toBeLessThanOrEqual(1);
  });

  it('reduced motion means no transition, not a fast one', () => {
    // `initial: false` tells framer-motion to paint the final state and skip
    // the tween. A zero-distance animation would still run, and still delay.
    expect(rise(true, 0.4).initial).toBe(false);
    expect(rise(true, 0.4).transition.delay).toBe(0);
    expect(riseCard(true, 9).initial).toBe(false);
    expect(riseCard(true, 9).transition.delay).toBe(0);

    // And it still animates when the preference is absent.
    expect(rise(false, 0.4).initial).not.toBe(false);
    expect(rise(false, 0.4).transition.delay).toBe(0.4);
  });
});

// ── The rules that are invisible until they break ──────────────────

describe('the namespace is not shared with the landing page', () => {
  /**
   * The bug this exists to prevent, because it shipped.
   *
   * The match surfaces were renamed out of `.q-*` into `.oi-*` without
   * checking what `.oi-*` already contained. Two names were occupied:
   *
   *   `.oi-glass`  — the landing page's glass over photography, used by
   *                  HowItWorks, Portfolio, Problem and snapshots. Those
   *                  frames silently inherited the match card's hover-scale
   *                  and transform.
   *
   *   `.oi-reveal` — the FAQ accordion: `display: grid; grid-template-rows:
   *                  0fr`, opening on `data-open="true"`. The match card
   *                  writes `data-open="yes"`, so EVERY CARD ON /match
   *                  collapsed to zero height with its contents clipped.
   *
   * Nothing caught it. Typecheck passes — they are strings. Lint passes. The
   * class-existence check passed, because both names were very much defined;
   * it only ever asked whether a used class exists, never whether a name was
   * already spoken for. That is the asymmetry this test closes.
   */
  const LANDING_OWNED = [
    'oi-glass',
    'oi-glass-inner',
    'oi-reveal',
    'oi-rail',
    'oi-swap',
    'oi-rise-in',
    'oi-card-in',
    'oi-card-tilt',
    'oi-ring',
    'oi-check-row',
    'oi-progress',
    'oi-rule',
    'oi-stack',
    'oi-landing',
  ];

  const NEW_SYSTEM_FILES = [
    'src/components/oi/Surfaces.tsx',
    'src/app/match/StudioCard.tsx',
    'src/app/match/ProjectWings.tsx',
    'src/app/match/MatchHero.tsx',
    'src/app/studios/[slug]/page.tsx',
    'src/app/studios/[slug]/Verified.tsx',
    'src/app/studios/[slug]/Record.tsx',
  ];

  it('no new-language file reaches for a landing-owned class', () => {
    for (const file of NEW_SYSTEM_FILES) {
      const src = readFileSync(join(ROOT, file), 'utf8');
      // Only className strings — prose in the doc comments names them freely,
      // and explaining the collision is exactly what those comments are for.
      const classes = [...src.matchAll(/className=(?:"|'|\{`)([^"'`]*)/g)]
        .flatMap((m) => m[1]!.split(/\s+/))
        .filter(Boolean);

      for (const owned of LANDING_OWNED) {
        expect(classes, `${file} uses landing-owned .${owned}`).not.toContain(owned);
      }
    }
  });

  it('the classes the new system owns are not reached for by the landing page', () => {
    // The same check from the other side. If a landing component starts using
    // .oi-pane it inherits a scroll-focus depth-of-field it has no data-focus
    // for, and the collision is back with the roles reversed.
    const OURS = ['oi-pane', 'oi-wings', 'oi-drawer', 'oi-drawer-far', 'oi-pill', 'oi-tick'];
    const dir = join(ROOT, 'src/components/landing');
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
      );

    for (const file of walk(dir).filter((f) => f.endsWith('.tsx'))) {
      const src = readFileSync(file, 'utf8');
      const classes = [...src.matchAll(/className=(?:"|'|\{`)([^"'`]*)/g)]
        .flatMap((m) => m[1]!.split(/\s+/))
        .filter(Boolean);
      for (const ours of OURS) {
        expect(classes, `${file} uses .${ours}, which the match system owns`).not.toContain(ours);
      }
    }
  });

  it('the FAQ accordion still opens on its own attribute value', () => {
    // It opens on data-open="true"; the drawers open on data-open="yes". Two
    // different vocabularies on one attribute name is what made the collision
    // silent rather than loud — the card was not just styled wrongly, it was
    // styled by a rule whose open state it could never satisfy.
    expect(css).toContain(".oi-reveal[data-open='true']");
    expect(css).toContain(".oi-wings[data-open='yes']");
  });
});

describe('the traps the doc lists', () => {
  it('the glass transform is composed from custom properties', () => {
    // Two rules both setting `transform` is the sharpest trap here: the
    // scroll-focus zoom and the hover lift would silently clobber each other.
    expect(css).toContain('--oi-scale');
    expect(css).toContain('--oi-lift');
    expect(css).toContain('transform: scale(var(--oi-scale)) translateY(var(--oi-lift))');
  });

  it('a faded card recovers on hover and on keyboard focus', () => {
    // A card you cannot read is a bug, not an effect.
    expect(css).toContain(".oi-pane[data-focus='far']:hover");
    expect(css).toContain(".oi-pane[data-focus='far']:focus-within");
  });

  it('the reduced-motion block repeats the open-state selectors in full', () => {
    /**
     * Specificity, not style. `.oi-pill` is (0,1,0) and
     * `.oi-wings[data-open='yes'] .oi-pill` is (0,3,0) — so the short form
     * alone loses, the delays survive, and the build ships claiming an
     * accessibility feature it does not have. Wrapping in :where() makes it
     * worse: that zeroes the specificity you need.
     */
    const block = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain(".oi-wings[data-open='yes'] .oi-pill");
    expect(block).toContain('.oi-wings:hover .oi-pill');
    expect(block).toContain('.oi-wings:focus-within .oi-pill');
  });

  it('the card glass alpha has not been thinned', () => {
    // Every contrast figure above is computed at 0.72. Below it, the ground
    // under the text starts depending on whatever scrolls behind the card,
    // which cannot be measured and therefore cannot be shipped.
    expect(css).toContain('background: rgba(252, 252, 250, 0.72)');
  });

  it('the pill keeps the saturate that makes it read as glass', () => {
    expect(css).toContain('blur(22px) saturate(180%)');
  });
});
