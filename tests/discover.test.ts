import { describe, expect, it } from 'vitest';
import { boardFor, builtPins, discoverPins, examplePins, type Pin } from '@/modules/discover/pins';
import { REVEAL_AT, boards, nextPins, revealStyle, styleWeights } from '@/modules/discover/feed';
import type { PortfolioProject } from '@/modules/studio/types';
import { readImageTags, withImageTag } from '@/modules/discover/tags';

function project(over: Partial<PortfolioProject>): PortfolioProject {
  return {
    id: 'p1',
    title: 'A flat',
    locality: 'Baner',
    propertyType: 'BHK_2',
    scope: 'FULL_HOME',
    styleTags: ['warm-modern'],
    valuePaise: 1_800_000_00,
    durationDays: 60,
    completedOn: null,
    images: ['https://example.supabase.co/a.jpg', 'https://example.supabase.co/b.jpg'],
    isRender: false,
    clientConsented: true,
    carpetAreaSqft: 900,
    imageRooms: ['LIVING', 'KITCHEN'],
    pickerConsent: true,
    imageTags: [{ materials: ['Wood veneer'], checked: true }, { materials: [], checked: true }],
    ...over,
  } as PortfolioProject;
}

describe('discover pins', () => {
  it('only takes consented, real photographs', () => {
    const pins = builtPins([
      {
        id: 's1',
        portfolio: [
          project({ id: 'ok' }),
          project({ id: 'noconsent', pickerConsent: false }),
          project({ id: 'render', isRender: true }),
          project({ id: 'nostyle', styleTags: ['made-up'] as unknown as PortfolioProject['styleTags'] }),
        ],
      },
    ]);
    expect(pins.map((p) => p.id)).toEqual(['b:ok:0', 'b:ok:1']);
    expect(pins[0]!.room).toBe('living');
    expect(pins[1]!.room).toBe('kitchen');
    expect(pins[0]!.studioId).toBe('s1');
  });

  it('prices a built pin from what the home cost per sq ft', () => {
    const [pin] = builtPins([{ id: 's1', portfolio: [project({})] }]);
    expect(pin!.perSqft).toBe(2000); // ₹18 L over 900 sq ft
    expect(pin!.tier).toBe('PREMIUM');
    const [unknown] = builtPins([{ id: 's1', portfolio: [project({ carpetAreaSqft: null })] }]);
    expect(unknown!.perSqft).toBeNull();
    expect(unknown!.tier).toBeNull();
  });

  it('labels examples, credits them and never prices them', () => {
    const ex = examplePins();
    expect(ex.length).toBeGreaterThanOrEqual(12);
    for (const p of ex) {
      expect(p.kind).toBe('example');
      expect(p.credit).toBeTruthy();
      expect(p.tier).toBeNull();
    }
  });

  it('never shows a style the customer ruled out', () => {
    const pins = discoverPins([{ id: 's1', portfolio: [project({})] }], ['warm-modern']);
    expect(pins.some((p) => p.styles[0] === 'warm-modern')).toBe(false);
  });

  it('maps studio room names onto the five boards', () => {
    expect(boardFor('MASTER_BEDROOM')).toBe('bedroom');
    expect(boardFor('DINING')).toBe('living');
    expect(boardFor('POOJA')).toBe('mandir');
    expect(boardFor('')).toBe('other');
  });
});

describe('discover feed', () => {
  const pins = discoverPins([]);
  const japandi = pins.filter((p) => p.styles[0] === 'japandi').map((p) => p.id);

  it('leans toward what was saved', () => {
    const state = { saved: japandi, skipped: [] };
    const w = styleWeights(pins, state);
    expect(w.get('japandi')).toBeGreaterThan(w.get('industrial')!);
    const seen = new Set(japandi);
    const next = nextPins(pins, state, seen, 4);
    // Japandi pins are all seen; the next best are its neighbours or a surprise, never a repeat.
    expect(next.every((p) => !seen.has(p.id))).toBe(true);
  });

  it('is the same every time for the same saves', () => {
    const a = nextPins(pins, { saved: [], skipped: [] }, new Set(), 10).map((p) => p.id);
    const b = nextPins(pins, { saved: [], skipped: [] }, new Set(), 10).map((p) => p.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(10);
  });

  it('never shows three of one style in a row', () => {
    const first = pins.find((p) => p.styles[0] === 'luxe-glam')!;
    const many = pins.filter((p) => p.styles[0] === 'luxe-glam').map((p) => p.id);
    const out = nextPins(pins, { saved: [...many, first.id], skipped: [] }, new Set(), 12);
    for (let i = 2; i < out.length; i++) {
      const run = [out[i - 2]!, out[i - 1]!, out[i]!].map((p) => p.styles[0]);
      expect(run[0] === run[1] && run[1] === run[2]).toBe(false);
    }
  });

  it('filters by board', () => {
    const out = nextPins(pins, { saved: [], skipped: [] }, new Set(), 50, 'kitchen');
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((p) => p.room === 'kitchen')).toBe(true);
  });
});

describe('style reveal', () => {
  const pins: Pin[] = Array.from({ length: 30 }, (_, i) => ({
    id: `b:p${i}:0`,
    kind: 'built',
    src: 'x',
    alt: 'x',
    room: 'living',
    styles: i < 15 ? ['warm-modern', 'indian-contemporary'] : i < 25 ? ['japandi'] : ['industrial'],
    studioId: i < 15 ? 'sA' : 'sB',
    perSqft: 2000,
    tier: 'PREMIUM',
    materials: [],
    credit: null,
    creditUrl: null,
  }));

  it(`waits for ${REVEAL_AT} saves`, () => {
    expect(revealStyle(pins, pins.slice(0, REVEAL_AT - 1).map((p) => p.id)).ready).toBe(false);
    expect(revealStyle(pins, pins.slice(0, REVEAL_AT).map((p) => p.id)).ready).toBe(true);
  });

  it('reveals early only when the feed has run out', () => {
    const six = pins.slice(0, 6).map((p) => p.id);
    expect(revealStyle(pins, six).ready).toBe(false);
    expect(revealStyle(pins, six, true).ready).toBe(true);
  });

  it('gives up to three styles that add to 100', () => {
    const r = revealStyle(pins, pins.map((p) => p.id));
    expect(r.shares.length).toBeLessThanOrEqual(3);
    expect(r.shares.reduce((s, x) => s + x.pct, 0)).toBe(100);
    expect(r.shares[0]!.tag).toBe('warm-modern');
    expect(r.tier).toBe('PREMIUM');
    expect(r.studioIds).toEqual(['sA', 'sB']);
  });

  it('groups saves into boards, newest first', () => {
    const b = boards(pins, ['b:p0:0', 'b:p1:0']);
    expect(b.living.map((p) => p.id)).toEqual(['b:p1:0', 'b:p0:0']);
  });
});

describe('photo tags', () => {
  it('keeps unchecked photos out of the feed', () => {
    const pins = builtPins([{ id: 's1', portfolio: [project({ imageTags: [{ checked: true }, { checked: false }] })] }]);
    expect(pins.map((p) => p.id)).toEqual(['b:p1:0']);
    expect(builtPins([{ id: 's1', portfolio: [project({ imageTags: null })] }])).toEqual([]);
  });

  it('carries the tagged materials onto the pin', () => {
    const [pin] = builtPins([{ id: 's1', portfolio: [project({})] }]);
    expect(pin!.materials).toEqual(['Wood veneer']);
  });

  it('reads stored tags defensively, aligned to the images', () => {
    const tags = readImageTags([{ materials: ['Quartz', 'Plutonium'], checked: true }, 'junk'], 3);
    expect(tags).toHaveLength(3);
    expect(tags[0]!.materials).toEqual(['Quartz']);
    expect(tags[1]!.checked).toBe(false);
  });

  it('records who checked a photo and clears it on uncheck', () => {
    const now = new Date('2026-11-07T10:00:00Z');
    const start = readImageTags([], 2);
    const on = withImageTag(start, 1, { checked: true, materials: ['Cane'] }, 'ops@x', now);
    expect(on[1]).toEqual({ materials: ['Cane'], checked: true, checkedBy: 'ops@x', checkedAt: now.toISOString() });
    expect(on[0]!.checked).toBe(false);
    const off = withImageTag(on, 1, { checked: false }, 'ops@x', now);
    expect(off[1]!.checkedBy).toBeNull();
    expect(off[1]!.materials).toEqual(['Cane']);
  });
});

describe('photo suggestions and saves', () => {
  it('keeps only our rooms, styles and materials from Claude', async () => {
    const { readSuggestion } = await import('@/modules/discover/suggest');
    const s = readSuggestion('Sure: {"room":"KITCHEN","styles":["japandi","boho"],"materials":["Quartz","Gold leaf"],"looksRendered":true}');
    expect(s).toEqual({ room: 'KITCHEN', styles: ['japandi'], materials: ['Quartz'], looksRendered: true });
    expect(readSuggestion('no json here')).toBeNull();
    expect(readSuggestion('{"room":"GARAGE"}')!.room).toBeNull();
  });

  it('stores only pin-shaped ids, no repeats, newest kept', async () => {
    const { cleanSaves, MAX_SAVES } = await import('@/modules/discover/feed');
    expect(cleanSaves(['b:p1:0', 'b:p1:0', 'x:japandi:living', 'drop table', 42])).toEqual(['b:p1:0', 'x:japandi:living']);
    const many = Array.from({ length: MAX_SAVES + 5 }, (_, i) => `b:p${i}:0`);
    const kept = cleanSaves(many);
    expect(kept).toHaveLength(MAX_SAVES);
    expect(kept.at(-1)).toBe(`b:p${MAX_SAVES + 4}:0`);
    expect(cleanSaves('nope')).toEqual([]);
  });
});
