import { describe, expect, it } from 'vitest';
import {
  LOCALITIES_BY_ZONE,
  PUNE_LOCALITIES,
  ZONE_LABELS,
  localityLabel,
  zoneOf,
} from '@/modules/brief/types';

/**
 * Sixty-four localities, and a hard filter standing behind them.
 *
 * Locality excludes a studio from a customer's results entirely. While the
 * list had twelve entries that was safe — a studio ticking six covered half of
 * Pune. At sixty-four it is a trap, and the symptom is the worst kind: the
 * customer sees an empty match page, reads it as "nobody wants my job", and
 * leaves. Nothing errors, nothing is logged.
 *
 * So the zone is load-bearing, and these are the assertions that keep it that
 * way.
 */

describe('the list itself', () => {
  it('has no duplicate slugs', () => {
    // A duplicate silently wins or loses depending on iteration order, and
    // `zoneOf` would return whichever came first.
    const slugs = PUNE_LOCALITIES.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives every locality a zone we have a label for', () => {
    // An unlabelled zone renders an empty heading and drops its localities out
    // of the grouped UI entirely — they become untickable.
    for (const l of PUNE_LOCALITIES) {
      expect(ZONE_LABELS[l.zone], `${l.slug} → ${l.zone}`).toBeTruthy();
    }
  });

  it('keeps every original slug, because they are stored on real rows', () => {
    /**
     * These twelve are written on briefs, studio rows and portfolio projects.
     * Renaming one does not error — it silently stops matching, and the
     * symptom is a studio quietly receiving less work with no way to notice.
     */
    const ORIGINAL = [
      'kharadi', 'baner', 'wakad', 'hinjewadi', 'kothrud', 'viman-nagar',
      'aundh', 'hadapsar', 'balewadi', 'undri', 'ravet', 'magarpatta',
    ];
    const slugs = new Set(PUNE_LOCALITIES.map((l) => l.slug));
    for (const s of ORIGINAL) expect(slugs.has(s), s).toBe(true);
  });

  it('loses nothing in the grouping', () => {
    // LOCALITIES_BY_ZONE is what every picker renders. A locality in the flat
    // list but in no group is one nobody can ever select.
    const grouped = LOCALITIES_BY_ZONE.flatMap((g) => g.localities);
    expect(grouped.length).toBe(PUNE_LOCALITIES.length);
  });

  it('covers west Pune properly, since that is where the studios are', () => {
    const slugs = new Set(PUNE_LOCALITIES.map((l) => l.slug));
    for (const s of [
      'baner', 'balewadi', 'aundh', 'pashan', 'sus', 'bavdhan',
      'wakad', 'hinjewadi', 'punawale', 'tathawade', 'ravet', 'thergaon',
      'pimple-saudagar', 'chinchwad', 'pimpri', 'nigdi', 'akurdi',
      'kothrud', 'warje', 'karve-nagar', 'sinhagad-road', 'dhayari',
    ]) {
      expect(slugs.has(s), `west Pune is missing ${s}`).toBe(true);
    }
  });
});

describe('zoneOf', () => {
  it('reads the zone back', () => {
    expect(zoneOf('baner')).toBe('west');
    expect(zoneOf('kharadi')).toBe('east');
    expect(zoneOf('wakad')).toBe('pcmc');
  });

  it('returns null for an unknown or absent slug rather than throwing', () => {
    // An older row may hold a slug this build does not know. The filter treats
    // null as "no opinion" and fails open, which is the safe direction.
    expect(zoneOf('atlantis')).toBeNull();
    expect(zoneOf(null)).toBeNull();
    expect(zoneOf('')).toBeNull();
  });
});

describe('localityLabel', () => {
  it('labels a known slug', () => {
    expect(localityLabel('pimple-saudagar')).toBe('Pimple Saudagar');
  });

  it('degrades to a readable form rather than to undefined', () => {
    // Same contract as propertyLabel and scopeLabel: a stored value this build
    // does not recognise must not render as a blank in the middle of a
    // sentence.
    expect(localityLabel('some-old-area')).toBe('Some Old Area');
    expect(localityLabel(null)).toBeNull();
  });
});

describe('the neighbours a customer should still see', () => {
  /**
   * The point of the whole change, stated as pairs. Somebody in Pashan must
   * still be shown a studio working in Baner — ten minutes away — and must not
   * be shown one whose only ticked area is Kharadi, across the city.
   */
  it('keeps west Pune together', () => {
    for (const [a, b] of [
      ['pashan', 'baner'],
      ['sus', 'balewadi'],
      ['bavdhan', 'aundh'],
    ]) {
      expect(zoneOf(a), `${a} / ${b}`).toBe(zoneOf(b));
    }
  });

  it('keeps the Pimpri-Chinchwad belt together', () => {
    for (const [a, b] of [
      ['punawale', 'ravet'],
      ['pimple-saudagar', 'wakad'],
      ['akurdi', 'nigdi'],
    ]) {
      expect(zoneOf(a), `${a} / ${b}`).toBe(zoneOf(b));
    }
  });

  it('does not put opposite ends of the city in one zone', () => {
    for (const [a, b] of [
      ['baner', 'kharadi'],
      ['nigdi', 'undri'],
      ['kothrud', 'wagholi'],
      ['koregaon-park', 'dhayari'],
    ]) {
      expect(zoneOf(a), `${a} / ${b}`).not.toBe(zoneOf(b));
    }
  });
});
